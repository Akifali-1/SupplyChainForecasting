import os
import pickle
import pandas as pd
import numpy as np
import torch
from pymongo import MongoClient
from sklearn.preprocessing import StandardScaler

class DemandPredictor:
    def __init__(self):
        self.mongo_uri = os.getenv('MONGO_URI')
        self.client = None
        self.db = None
        self.debug = os.getenv('ML_DEBUG', '0').lower() == '1'
        self._connect_mongo()
    
    def _connect_mongo(self):
        try:
            if not self.mongo_uri:
                raise ValueError("MONGO_URI environment variable not set")
            self.client = MongoClient(self.mongo_uri, 
                                    tls=True,
                                    tlsAllowInvalidCertificates=True,
                                    serverSelectionTimeoutMS=30000)
            self.db = self.client.supplychain
            if self.debug:
                print("✓ Connected to MongoDB Atlas for prediction")
        except Exception as e:
            if self.debug:
                print(f"✗ Failed to connect to MongoDB: {e}")
            self.client = None
            self.db = None
    
    def _load_company_model(self, company_id):
        """Load fine-tuned GAT+LSTM company model from MongoDB Atlas"""
        try:
            if self.db is None:
                raise Exception("MongoDB connection not available")
            
            model_doc = self.db.company_models.find_one({'company_id': company_id})
            if not model_doc:
                raise Exception(f"Company model not found for company {company_id}")
            
            # Only GAT+LSTM models supported
            if model_doc.get('model_type') != 'GAT-LSTM Hybrid':
                raise Exception(f"Unsupported model type: {model_doc.get('model_type')}. Only GAT+LSTM models are supported.")
            
            # Handle GridFS storage
            if model_doc.get('model_storage', {}).get('type') == 'gridfs':
                if self.debug:
                    print("Loading company model from GridFS...")
                import gridfs
                fs = gridfs.GridFS(self.db)
                file_id = model_doc['model_storage']['file_id']
                
                try:
                    from bson import ObjectId
                    grid_file = fs.get(ObjectId(file_id))
                    model_bytes = grid_file.read()
                    model_state = pickle.loads(model_bytes)
                    if self.debug:
                        print(f"✓ Loaded company model from GridFS: {len(model_bytes) / (1024*1024):.2f} MB")
                except Exception as gridfs_error:
                    print(f"✗ GridFS loading failed: {gridfs_error}")
                    raise Exception("Failed to load company model from GridFS")
            else:
                # Handle embedded storage
                model_state = pickle.loads(model_doc['model_storage']['model_bytes'])
            
            from training.trainer import HybridGATLSTM
            
            # Load GAT+LSTM model
            if self.debug:
                print("Loading GAT+LSTM Hybrid model for prediction...")
            architecture = model_doc['architecture']
            model = HybridGATLSTM(
                in_channels=1,
                max_timesteps=architecture['max_timesteps'],
                gat_hidden=architecture['gat_hidden'],
                gat_heads=architecture['gat_heads'],
                lstm_hidden=architecture['lstm_hidden'],
                dropout=architecture['dropout']
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
        """Load company's uploaded CSV files"""
        try:
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
                        mean = np.array(scaler_data['mean_'])
                        scale = np.array(scaler_data['scale_'])
                        
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
        
        For each forecast day:
        1. Run model forward pass to get next-day prediction for all nodes
        2. Shift the input window: drop oldest timestep, append prediction as newest
        3. Inverse-scale the prediction and store it
        4. Repeat for forecast_days
        
        Returns dict with day-wise predictions array and 30-day total.
        """
        try:
            if self.debug:
                print(f"\n{'='*60}")
                print(f"MAKING PREDICTION FOR COMPANY: {company_id}")
                print(f"{'='*60}")
            
            # 1. Load model and metadata
            model, model_doc = self._load_company_model(company_id)
            node_list = model_doc.get('node_list', [])
            if not node_list and model_doc.get('node_to_idx'):
                node_list = list(model_doc['node_to_idx'].keys())
            scalers = model_doc.get('scalers', {})
            max_timesteps = model_doc.get('architecture', {}).get('max_timesteps', 5)
            
            if self.debug:
                print(f"  Nodes: {len(node_list)}, Max timesteps: {max_timesteps}")
            
            # 2. Load company's data and prepare initial input
            sales_df, edges_df, nodes_df = self._load_company_data(company_id)
            x = self._prepare_time_series_from_sales(sales_df, node_list, max_timesteps, scalers)
            edge_index = self._build_edge_index_from_edges(edges_df, node_list)
            
            # 3. Find requested product (exact case-insensitive match only)
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
                if self.debug:
                    print(f"  Product '{requested_product}' not found in node list")
                    print(f"  Available: {node_list[:10]}...")
                # Return error instead of silently falling back
                raise ValueError(f"Product '{requested_product}' not found. Available: {node_list[:10]}")
            
            if product_idx is None:
                product_idx = 0  # Default to first node if no product specified
            
            # 4. Parse forecast days
            try:
                forecast_days = int(forecast_days or 30)
            except (TypeError, ValueError):
                forecast_days = 30
            forecast_days = max(1, min(forecast_days, 30))
            
            # 5. Autoregressive rollout for forecast_days
            model.eval()
            daily_predictions = []
            current_x = x.clone()  # (num_nodes, max_timesteps, 1)
            
            with torch.no_grad():
                for day in range(forecast_days):
                    # Forward pass — get next-day prediction for all nodes
                    pred = model(current_x, edge_index)  # (num_nodes, 1)
                    
                    # Extract prediction for target product (in scaled space)
                    scaled_pred = pred[product_idx].item()
                    
                    # Inverse-scale to get real units
                    real_pred = scaled_pred
                    if scalers and node_list[product_idx] in scalers:
                        scaler_data = scalers[node_list[product_idx]]
                        mean = np.array(scaler_data.get('mean_', [0.0]))
                        scale = np.array(scaler_data.get('scale_', [1.0]))
                        real_pred = scaled_pred * (scale[0] if scale.size else 1.0) + (mean[0] if mean.size else 0.0)
                    
                    # Floor at zero (demand can't be negative)
                    real_pred = max(0.0, real_pred)
                    daily_predictions.append(round(real_pred, 2))
                    
                    # Shift window: drop oldest timestep, append prediction (in scaled space)
                    new_step = pred.unsqueeze(-1)  # (num_nodes, 1, 1)
                    current_x = torch.cat([current_x[:, 1:, :], new_step], dim=1)
                    
                    # Always print first 5 days so we can verify sanity in the terminal
                    if day < 5:
                        print(f"  [Predict] Day {day+1}: scaled={scaled_pred:.4f} | real={real_pred:.2f} | node={node_list[product_idx]}")
            
            # 6. Compute summary statistics
            total_30_days = sum(daily_predictions)
            average_daily = total_30_days / len(daily_predictions) if daily_predictions else 0.0
            
            if self.debug:
                print(f"\n  Forecast summary ({forecast_days} days):")
                print(f"    Total: {total_30_days:.2f}")
                print(f"    Avg daily: {average_daily:.2f}")
                print(f"    Range: [{min(daily_predictions):.2f}, {max(daily_predictions):.2f}]")
            
            result = {
                'company_id': company_id,
                'requested_product': requested_product,
                'matched_node': node_list[product_idx],
                'model_type': 'GAT-LSTM Hybrid',
                'forecast_days': forecast_days,
                'prediction': daily_predictions,
                'prediction_series': daily_predictions,
                'average_daily': round(average_daily, 2),
                'total_30_days': round(total_30_days, 2),
                'rawPredicted': round(max(daily_predictions) if daily_predictions else 0.0, 2),
                'confidence': 75,  # Base confidence, can be improved with proper uncertainty estimation
                'input_shape': list(x.shape),
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
            max_timesteps = model_doc.get('architecture', {}).get('max_timesteps', 5)
            
            # 2. Load company's data and prepare initial input
            sales_df, edges_df, nodes_df = self._load_company_data(company_id)
            x = self._prepare_time_series_from_sales(sales_df, node_list, max_timesteps, scalers)
            edge_index = self._build_edge_index_from_edges(edges_df, node_list)
            
            # 3. Parse forecast days
            try:
                forecast_days = int(forecast_days or 30)
            except (TypeError, ValueError):
                forecast_days = 30
            forecast_days = max(1, min(forecast_days, 30))
            
            # 4. Autoregressive rollout for forecast_days
            model.eval()
            num_nodes = len(node_list)
            daily_predictions = {node: [] for node in node_list}
            current_x = x.clone()
            
            with torch.no_grad():
                for day in range(forecast_days):
                    # Forward pass — get next-day prediction for all nodes
                    pred = model(current_x, edge_index)  # (num_nodes, 1)
                    
                    for i, node in enumerate(node_list):
                        scaled_pred = pred[i].item()
                        real_pred = scaled_pred
                        if scalers and node in scalers:
                            scaler_data = scalers[node]
                            mean = np.array(scaler_data.get('mean_', [0.0]))
                            scale = np.array(scaler_data.get('scale_', [1.0]))
                            real_pred = scaled_pred * (scale[0] if scale.size else 1.0) + (mean[0] if mean.size else 0.0)
                        
                        real_pred = max(0.0, real_pred)
                        daily_predictions[node].append(round(real_pred, 2))
                    
                    # Shift window
                    new_step = pred.unsqueeze(-1)  # (num_nodes, 1, 1)
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
            
            return results
            
        except Exception as e:
            print(f"\nError generating batch prediction: {e}")
            import traceback
            traceback.print_exc()
            raise

