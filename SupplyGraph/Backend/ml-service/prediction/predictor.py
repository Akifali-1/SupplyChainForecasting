import os
import pickle
import pandas as pd
import numpy as np
import torch
from sklearn.preprocessing import StandardScaler
from db.dynamodb_client import DynamoDBClient, S3ModelStore


class LegacyModelError(Exception):
    """Raised when a company's saved model was trained on the legacy GAT-LSTM architecture.
    The model cannot be used for inference and must be retrained with STGT."""
    pass

class DemandPredictor:
    def __init__(self):
        self.dynamo = None
        self.s3store = None
        self.debug = os.getenv('ML_DEBUG', '0').lower() == '1'
        self._init_aws()
    
    def _init_aws(self):
        """Initialise DynamoDB client and S3 model store."""
        try:
            self.dynamo = DynamoDBClient()
            if not self.dynamo.is_connected:
                print("DynamoDB not available for prediction")
                self.dynamo = None
            elif self.debug:
                print("✓ Connected to DynamoDB for prediction")
        except Exception as e:
            if self.debug:
                print(f"✗ Failed to init DynamoDB: {e}")
            self.dynamo = None

        try:
            self.s3store = S3ModelStore()
            if not self.s3store.is_configured:
                print("⚠️  S3ModelStore not configured for prediction")
                self.s3store = None
        except Exception as e:
            if self.debug:
                print(f"✗ Failed to init S3ModelStore: {e}")
            self.s3store = None
    
    def _load_company_model(self, company_id):
        """Load fine-tuned STGT company model from DynamoDB (metadata) + S3 (weights)."""
        try:
            if self.dynamo is None:
                raise Exception("DynamoDB connection not available")
            
            model_doc = self.dynamo.get_item(f"COMPANY#{company_id}", "MODEL")
            if not model_doc:
                raise Exception(f"Company model not found for company {company_id}")
            
            # Only STGT models are supported; legacy GAT-LSTM needs retrain
            if model_doc.get('model_type') != 'STGT':
                raise LegacyModelError(
                    f"Your model was trained on the legacy GAT-LSTM architecture and is no longer "
                    f"compatible. Please retrain your model to upgrade to STGT."
                )
            
            # Download weights from S3
            if self.s3store is None:
                raise Exception("S3ModelStore not configured")

            s3_uri = model_doc.get('s3Uri')
            if not s3_uri:
                raise Exception("Company model record has no s3Uri")

            if self.debug:
                print(f"Downloading company model from {s3_uri}...")
            model_bytes = self.s3store.download(s3_uri)
            model_state = pickle.loads(model_bytes)
            if self.debug:
                print(f"✓ Loaded company model from S3: {len(model_bytes) / (1024*1024):.2f} MB")
            
            from models.stgt import STGTModel
            
            # Load STGT model
            if self.debug:
                print("Loading STGT model for prediction...")
            architecture = model_doc['architecture']
            model = STGTModel(
                max_timesteps=int(architecture.get('max_timesteps', 14)),
                d_model=int(architecture.get('d_model', 64)),
                spatial_heads=int(architecture.get('spatial_heads', 4)),
                dropout=float(architecture.get('dropout', 0.3))
            )
            model.load_state_dict(model_state)
            model.eval()
            
            if self.debug:
                print(f"✓ Model loaded with {len(model_doc.get('node_list', []))} nodes")
            
            return model, model_doc
            
        except Exception as e:
            print(f"✗ Error loading company model: {e}")
            raise
    
    def _load_company_data(self, company_id):
        """Load company's uploaded CSV files from S3 or local disk"""
        try:
            s3_bucket = os.getenv('S3_UPLOADS_BUCKET')
            if s3_bucket:
                uploads_dir = os.path.join("/tmp", "uploads", company_id)
                os.makedirs(uploads_dir, exist_ok=True)
                
                import boto3
                from botocore.exceptions import ClientError
                
                s3_client = boto3.client('s3', region_name=os.getenv('AWS_REGION', 'us-east-1'))
                
                files_to_download = [
                    (f"processed/{company_id}/nodes.csv", "nodes.csv"),
                    (f"processed/{company_id}/Edges (Plant).csv", "Edges (Plant).csv"),
                    (f"processed/{company_id}/Sales Order.csv", "Sales Order.csv")
                ]
                
                for s3_key, local_name in files_to_download:
                    local_path = os.path.join(uploads_dir, local_name)
                    try:
                        if self.debug:
                            print(f"Downloading {s3_key} from S3 bucket {s3_bucket} to {local_path}...")
                        s3_client.download_file(s3_bucket, s3_key, local_path)
                    except ClientError as e:
                        if self.debug:
                            print(f"Error downloading {s3_key} from S3: {e}")
            else:
                backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                uploads_dir = os.path.join(backend_dir, 'uploads', company_id)
            
            if self.debug:
                print(f"Loading data from: {uploads_dir}")
            
            # Load sales data (UPDATED: Sales Order.csv)
            sales_path = os.path.join(uploads_dir, 'Sales Order.csv')
            edges_path = os.path.join(uploads_dir, 'Edges (Plant).csv')
            nodes_path = os.path.join(uploads_dir, 'nodes.csv')

            if not os.path.exists(sales_path):
                raise FileNotFoundError(f"Sales Order.csv not found at {sales_path}")
            
            sales_df = pd.read_csv(sales_path)
            
            # Load edges if available
            edges_df = None
            if os.path.exists(edges_path):
                edges_df = pd.read_csv(edges_path)
            
            # Load nodes if available
            nodes_df = None
            if os.path.exists(nodes_path):
                nodes_df = pd.read_csv(nodes_path)
            
            if self.debug:
                print(f"✓ Loaded sales: {len(sales_df)} rows")
                print(f"  Columns: {list(sales_df.columns)}")
                if edges_df is not None:
                    print(f"✓ Loaded edges: {len(edges_df)} rows")
                if nodes_df is not None:
                    print(f"✓ Loaded nodes: {len(nodes_df)} rows")
            
            return sales_df, edges_df, nodes_df
            
        except Exception as e:
            print(f"✗ Error loading company data: {e}")
            raise
    
    def _prepare_time_series_from_sales(self, sales_df, node_list, max_timesteps, scalers=None):
        """
        Prepare time series input from Sales Order wide-format data (Date + product columns).
        
        Format: 
        - Date column + product columns (one per node/product)
        - Each row is a time period
        - Values are sales quantities for that period
        """
        try:
            if self.debug:
                print(f"\n🔧 Preparing time series for {len(node_list)} nodes, {max_timesteps} timesteps")
            
            # Initialize output
            time_series_x = np.zeros((len(node_list), max_timesteps, 1))
            
            # Find date column (case-insensitive)
            date_col = None
            for col in sales_df.columns:
                if col.lower() in ('date', 'timestamp'):
                    date_col = col
                    break
            
            # Sort by date
            sales_copy = sales_df.copy()
            if date_col:
                try:
                    sales_copy[date_col] = pd.to_datetime(sales_copy[date_col], errors='coerce')
                    sales_copy = sales_copy.sort_values(date_col)
                except Exception as e:
                    if self.debug:
                        print(f"  ⚠️  Could not parse dates: {e}")
            
            # Extract time series for each node (product)
            for i, node_id in enumerate(node_list):
                # Check if this node/product exists as a column
                if node_id not in sales_copy.columns:
                    if self.debug:
                        print(f"  ⚠️  Node {node_id} not found in Sales Order columns")
                    continue
                
                # Get sales values for this product
                values = pd.to_numeric(sales_copy[node_id], errors='coerce').fillna(0.0).values
                
                # Take last max_timesteps values
                recent_values = values[-max_timesteps:]
                
                # Left-pad if shorter than max_timesteps
                if len(recent_values) < max_timesteps:
                    recent_values = np.pad(recent_values, (max_timesteps - len(recent_values), 0), 
                                          mode='constant', constant_values=0)
                
                time_series_x[i, :, 0] = recent_values
                
                if self.debug and i < 3:
                    print(f"  Node {node_id}: {recent_values.tolist()}")
            
            # Apply scalers if available (IMPORTANT: use SAME scalers as training)
            if scalers:
                if self.debug:
                    print("\n🔧 Applying scalers (same as training)...")
                
                for i, node_id in enumerate(node_list):
                    if node_id in scalers:
                        scaler_data = scalers[node_id]
                        mean = np.array(scaler_data['mean_'], dtype=float)
                        scale = np.array(scaler_data['scale_'], dtype=float)
                        
                        # Apply scaling: (x - mean) / scale
                        time_series_x[i, :, 0] = (time_series_x[i, :, 0] - mean) / (scale + 1e-8)
                        
                        if self.debug and i < 3:
                            print(f"  Scaled node {node_id}: mean={mean[0]:.2f}, scale={scale[0]:.2f}")
            
            # Data quality checks
            non_zero_nodes = np.sum(np.abs(time_series_x).sum(axis=(1, 2)) > 0)
            if self.debug:
                print(f"\n✓ Prepared time series: {time_series_x.shape}")
                print(f"  Non-zero nodes: {non_zero_nodes}/{len(node_list)}")
                print(f"  Value range: [{time_series_x.min():.2f}, {time_series_x.max():.2f}]")
                print(f"  Mean: {time_series_x.mean():.2f}")
            
            if non_zero_nodes == 0:
                print("⚠️  WARNING: All time series are zero! Check your Sales Order data.")
            
            return torch.tensor(time_series_x, dtype=torch.float)
            
        except Exception as e:
            print(f"✗ Error preparing time series: {e}")
            import traceback
            traceback.print_exc()
            raise

    def _recent_stats_for_product(self, sales_df, node_id, max_timesteps):
        """
        Compute recent raw stats (mean, max, trend) for calibration.
        Uses Sales Order format: Date + product columns.
        """
        try:
            if node_id not in sales_df.columns:
                return {'mean': 0.0, 'max': 0.0, 'trend': 'stable'}

            # Sort by date if available
            df = sales_df.copy()
            date_col = None
            for col in df.columns:
                if col.lower() in ('date', 'timestamp'):
                    date_col = col
                    break
            
            if date_col:
                try:
                    df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
                    df = df.sort_values(date_col)
                except Exception:
                    pass
            
            # Get product values
            vals = pd.to_numeric(df[node_id], errors='coerce').dropna().values
            if len(vals) == 0:
                return {'mean': 0.0, 'max': 0.0, 'trend': 'stable'}
            
            # Take recent values (use more for trend detection)
            lookback = min(max_timesteps * 2, len(vals))
            recent = vals[-lookback:]
            
            # Detect trend: require clear, sustained decline/increase
            # Only mark as 'down' if there's a significant (>20%) and consistent decline
            if len(recent) >= 6:
                # Compare first third vs last third to avoid noise
                first_third = recent[:len(recent)//3]
                last_third = recent[-len(recent)//3:]
                first_mean = float(np.mean(first_third))
                last_mean = float(np.mean(last_third))
                
                # Also check if last 3 values are consistently declining
                if len(recent) >= 3:
                    last_3 = recent[-3:]
                    is_consistently_declining = all(last_3[i] >= last_3[i+1] for i in range(len(last_3)-1))
                    is_consistently_increasing = all(last_3[i] <= last_3[i+1] for i in range(len(last_3)-1))
                else:
                    is_consistently_declining = False
                    is_consistently_increasing = False
                
                if first_mean > 0:
                    change_pct = ((last_mean - first_mean) / first_mean) * 100
                    # Require >20% change AND consistent pattern to mark as trend
                    if change_pct < -20 and is_consistently_declining:
                        trend = 'down'
                    elif change_pct > 20 and is_consistently_increasing:
                        trend = 'up'
                    else:
                        trend = 'stable'
                else:
                    trend = 'stable'
            else:
                trend = 'stable'
            
            # Use last max_timesteps for mean/max
            recent_for_stats = vals[-max_timesteps:] if len(vals) >= max_timesteps else vals
            
            return {
                'mean': float(np.mean(recent_for_stats)),
                'max': float(np.max(recent_for_stats)),
                'trend': trend,
                'recent_mean': float(np.mean(recent))
            }
        except Exception:
            return {'mean': 0.0, 'max': 0.0, 'trend': 'stable'}
    
    def _build_edge_index_from_edges(self, edges_df, node_list):
        """Build edge_index from Edges (Plant).csv format."""
        try:
            if edges_df is None or len(edges_df) == 0:
                return self._build_safe_edge_index(len(node_list))
            
            node_to_idx = {str(node).strip().upper(): i for i, node in enumerate(node_list)}
            edge_pairs = []
            
            for _, row in edges_df.iterrows():
                plant = str(row.get('Plant', '')).strip().upper()
                n1 = str(row.get('node1', '')).strip().upper()
                n2 = str(row.get('node2', '')).strip().upper()
                
                if not plant and not n1 and not n2:
                    continue
                
                pairs_to_add = []
                if plant and n1:
                    pairs_to_add.append((plant, n1))
                if plant and n2:
                    pairs_to_add.append((plant, n2))
                if n1 and n2:
                    pairs_to_add.append((n1, n2))
                
                for src, dst in pairs_to_add:
                    if src in node_to_idx and dst in node_to_idx:
                        edge_pairs.append((node_to_idx[src], node_to_idx[dst]))
            
            # Add self-loops for isolated nodes
            all_nodes = set(range(len(node_list)))
            connected = {s for s, _ in edge_pairs} | {t for _, t in edge_pairs}
            isolated = all_nodes - connected
            for idx in isolated:
                edge_pairs.append((idx, idx))
            
            if not edge_pairs:
                return self._build_safe_edge_index(len(node_list))
            
            return torch.tensor(edge_pairs, dtype=torch.long).t().contiguous()
            
        except Exception as e:
            print(f"Error building edge_index: {e}")
            return self._build_safe_edge_index(len(node_list))
    
    def _build_safe_edge_index(self, num_nodes):
        """Create self-loop edge_index as fallback."""
        if num_nodes <= 0:
            return torch.empty((2, 0), dtype=torch.long)
        indices = torch.arange(num_nodes, dtype=torch.long)
        return torch.stack([indices, indices], dim=0)
    
    def predict(self, company_id, input_data, forecast_days=30):
        """Generate demand prediction using autoregressive rollout for N days.
        
        Returns dict with day-wise predictions array and 30-day total.
        """
        try:
            if self.debug:
                print(f"\n{'='*60}")
                print(f"MAKING PREDICTION FOR COMPANY: {company_id}")
                print(f"{'='*60}")
            
            # Load metadata to find the matching index for the requested product
            _, model_doc = self._load_company_model(company_id)
            node_list = model_doc.get('node_list', [])
            if not node_list and model_doc.get('node_to_idx'):
                node_list = list(model_doc['node_to_idx'].keys())
            
            # Find requested product
            requested_product = None
            if isinstance(input_data, list) and len(input_data) > 0:
                requested_product = input_data[0].get('product', '')
            
            product_idx = None
            if requested_product:
                requested_upper = requested_product.strip().upper()
                for i, node in enumerate(node_list):
                    if node.strip().upper() == requested_upper:
                        product_idx = i
                        break
            
            if product_idx is None and requested_product:
                raise ValueError(f"Product '{requested_product}' not found. Available: {node_list[:10]}")
            
            if product_idx is None:
                product_idx = 0
            
            matched_node = node_list[product_idx]
            
            # 1. Run predict_all to get predictions for all nodes and update cache
            batch_results = self.predict_all(company_id, forecast_days)
            
            # 2. Get predictions for requested product
            product_data = batch_results.get(matched_node, {
                'prediction': [0.0] * forecast_days,
                'average_daily': 0.0,
                'total_30_days': 0.0
            })
            
            daily_predictions = product_data['prediction']
            average_daily = product_data['average_daily']
            total_30_days = product_data['total_30_days']
            
            # Fetch shape for metadata
            sales_df, _, _ = self._load_company_data(company_id)
            max_timesteps = model_doc.get('architecture', {}).get('max_timesteps', 5)
            
            result = {
                'company_id': company_id,
                'requested_product': requested_product,
                'matched_node': matched_node,
                'model_type': 'STGT',
                'forecast_days': forecast_days,
                'prediction': daily_predictions,
                'prediction_series': daily_predictions,
                'average_daily': round(average_daily, 2),
                'total_30_days': round(total_30_days, 2),
                'rawPredicted': round(max(daily_predictions) if daily_predictions else 0.0, 2),
                'confidence': 75,
                'input_shape': [len(node_list), max_timesteps, 1],
                'timestamp': pd.Timestamp.now().isoformat()
            }
            
            if self.debug:
                print(f"\n  FINAL: {forecast_days}-day total = {total_30_days:.2f}")
                print(f"{'='*60}\n")
            
            return result
            
        except Exception as e:
            print(f"\nError generating prediction: {e}")
            import traceback
            traceback.print_exc()
            raise

    def predict_all(self, company_id, forecast_days=30):
        """Generate demand prediction using autoregressive rollout for N days for ALL nodes simultaneously.
        
        Returns a dictionary mapping node_id (product name) to its prediction result.
        Also caches results in DynamoDB.
        """
        try:
            if self.debug:
                print(f"\n{'='*60}")
                print(f"MAKING BATCH PREDICTION FOR COMPANY: {company_id}")
                print(f"{'='*60}")
            
            # 1. Load model and metadata
            model, model_doc = self._load_company_model(company_id)
            node_list = model_doc.get('node_list', [])
            if not node_list and model_doc.get('node_to_idx'):
                node_list = list(model_doc['node_to_idx'].keys())
            scalers = model_doc.get('scalers', {})
            max_timesteps = int(model_doc.get('architecture', {}).get('max_timesteps', 14))
            
            # 2. Load company's data and prepare initial input
            sales_df, edges_df, nodes_df = self._load_company_data(company_id)
            x = self._prepare_time_series_from_sales(sales_df, node_list, max_timesteps, scalers)
            edge_index = self._build_edge_index_from_edges(edges_df, node_list)
            
            # 2b. Parse node types for prediction forward pass
            node_types_list = model_doc.get('node_types', [])
            if node_types_list:
                node_types_list = [int(x) for x in node_types_list]
            else:
                node_types_list = []
                for node in node_list:
                    if node.startswith("REG_"):
                        node_types_list.append(0)
                    elif node.startswith("CITY_"):
                        node_types_list.append(1)
                    elif node.startswith("STORE_"):
                        node_types_list.append(2)
                    elif node.startswith("FAM_"):
                        node_types_list.append(3)
                    else:
                        node_types_list.append(3)
            node_types = torch.tensor(node_types_list, dtype=torch.long).to(x.device)
            
            # 3. Parse forecast days
            try:
                forecast_days = int(forecast_days or 30)
            except (TypeError, ValueError):
                forecast_days = 30
            forecast_days = max(1, min(forecast_days, 30))
            
            # 4. Autoregressive rollout for forecast_days
            model.eval()
            daily_predictions = {node: [] for node in node_list}
            current_x = x.clone()
            
            with torch.no_grad():
                for day in range(forecast_days):
                    # Forward pass — get next-day prediction for all nodes
                    pred = model(current_x, edge_index, node_types)  # (num_nodes, 1)
                    
                    for i, node in enumerate(node_list):
                        scaled_pred = pred[i].item()
                        real_pred = scaled_pred
                        if scalers and node in scalers:
                            scaler_data = scalers[node]
                            mean = np.array(scaler_data.get('mean_', [0.0]), dtype=float)
                            scale = np.array(scaler_data.get('scale_', [1.0]), dtype=float)
                            real_pred = scaled_pred * (scale[0] if scale.size else 1.0) + (mean[0] if mean.size else 0.0)
                        
                        real_pred = max(0.0, real_pred)
                        daily_predictions[node].append(round(real_pred, 2))
                    
                    # Shift window
                    new_step = pred.unsqueeze(-1)  # (num_nodes, 1, 1)
                    
                    # Inject noise + momentum to prevent autoregressive mean collapse
                    if day > 1:
                        noise_scale = 0.03 * (1 + day * 0.01)
                        noise = torch.randn_like(new_step) * noise_scale
                        if day > 3:
                            running_mean = current_x.mean(dim=1, keepdim=True)
                            new_step = 0.85 * new_step + 0.15 * running_mean + noise
                        else:
                            new_step = new_step + noise
                            
                    current_x = torch.cat([current_x[:, 1:, :], new_step], dim=1)
            
            # 5. Build results dictionary
            results = {}
            for node in node_list:
                preds = daily_predictions[node]
                total_30_days = sum(preds)
                average_daily = total_30_days / len(preds) if preds else 0.0
                results[node] = {
                    'prediction': preds,
                    'average_daily': round(average_daily, 2),
                    'total_30_days': round(total_30_days, 2)
                }
            
            # 6. Cache predictions to DynamoDB
            if self.dynamo is not None:
                try:
                    cache_item = {
                        'PK': f"COMPANY#{company_id}",
                        'SK': 'PREDICTION_CACHE',
                        'company_id': company_id,
                        'predictions': results,
                        'updated_at': pd.Timestamp.now().isoformat()
                    }
                    self.dynamo.put_item(cache_item)
                    if self.debug:
                        print("✓ Cached predictions to PREDICTION_CACHE in DynamoDB")
                except Exception as cache_err:
                    print(f"⚠️ Failed to cache predictions to DynamoDB: {cache_err}")
            
            return results
            
        except Exception as e:
            print(f"\nError generating batch prediction: {e}")
            import traceback
            traceback.print_exc()
            raise


