import os
import pickle
import math
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
    
    def _generate_forecast_series(self, base_value, recent_stats, days):
        """
        Create a smooth multi-day forecast using the single-step prediction plus recent trends.
        This is a heuristic to provide the UI with a 30-day trajectory.
        """
        if days <= 1:
            return [round(max(0.0, base_value), 2)]
        
        mean = recent_stats.get('mean', base_value) or base_value
        max_val = max(recent_stats.get('max', base_value), base_value)
        trend = recent_stats.get('trend', 'stable') or 'stable'
        
        amplitude = max(5.0, abs(mean) * 0.15, abs(max_val - mean) * 0.5, abs(base_value) * 0.1)
        if amplitude == 0:
            amplitude = max(1.0, base_value * 0.1)
        
        values = []
        for day in range(days):
            progress = day / max(1, days - 1)
            if trend == 'up':
                target = base_value + amplitude * (0.5 + progress)
            elif trend == 'down':
                target = max(0.0, base_value - amplitude * (0.5 + progress))
            else:
                target = mean + math.sin(progress * math.pi) * amplitude
            blended = (base_value * 0.4) + (target * 0.6)
            values.append(round(max(0.0, blended), 2))
        return values
    
    def _build_edge_index_from_edges(self, edges_df, node_list):
        """
        Build edge_index from Edges (Plant).csv format.
        
        Format: Plant, node1, node2
        - Creates edges between Plant-node1, Plant-node2, node1-node2
        - Case-insensitive matching
        """
        try:
            if edges_df is None or len(edges_df) == 0:
                if self.debug:
                    print("⚠️ No edges data, using self-loops")
                return self._build_safe_edge_index(len(node_list))
            
            # Create case-insensitive node mapping
            node_to_idx = {str(node).strip().upper(): i for i, node in enumerate(node_list)}
            
            if self.debug:
                print(f"\n🔧 Building edge index from {len(edges_df)} edge records...")
                print(f"  Node mapping sample (first 5): {list(node_to_idx.items())[:5]}")
            
            edge_pairs = []
            edges_created = 0
            
            for _, row in edges_df.iterrows():
                plant = str(row.get('Plant', '')).strip().upper()
                n1 = str(row.get('node1', '')).strip().upper()
                n2 = str(row.get('node2', '')).strip().upper()
                
                # Skip empty nodes
                if not plant and not n1 and not n2:
                    continue
                
                # Create edges between all valid pairs
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
                        edges_created += 1
            
            if self.debug:
                print(f"  Created {edges_created} directed edges")
            
            # Add self-loops for isolated nodes
            all_nodes = set(range(len(node_list)))
            connected = {s for s, _ in edge_pairs} | {t for _, t in edge_pairs}
            isolated = all_nodes - connected
            
            for idx in isolated:
                edge_pairs.append((idx, idx))
            
            if self.debug and isolated:
                print(f"  Added {len(isolated)} self-loops for isolated nodes")
            
            if not edge_pairs:
                if self.debug:
                    print("  ⚠️ No valid edges created, using fallback")
                return self._build_safe_edge_index(len(node_list))
            
            edge_index = torch.tensor(edge_pairs, dtype=torch.long).t().contiguous()
            
            if self.debug:
                print(f"✓ Built edge_index: {edge_index.shape}")
            
            return edge_index
            
        except Exception as e:
            print(f"✗ Error building edge_index: {e}")
            import traceback
            traceback.print_exc()
            return self._build_safe_edge_index(len(node_list))
        
    def _build_safe_edge_index(self, num_nodes):
        """Create self-loop edge_index as fallback"""
        if num_nodes <= 0:
            return torch.empty((2, 0), dtype=torch.long)
        
        indices = torch.arange(num_nodes, dtype=torch.long)
        edge_index = torch.stack([indices, indices], dim=0)
        
        if self.debug:
            print(f"  Created fallback edge_index with {num_nodes} self-loops")
        
        return edge_index
    
    def predict(self, company_id, input_data, forecast_days=1):
        """Generate demand prediction for a company using REAL data"""
        try:
            if self.debug:
                print(f"\n{'='*60}")
                print(f"🔮 MAKING PREDICTION FOR COMPANY: {company_id}")
                print(f"{'='*60}")
                print(f"Input data: {input_data}")
            
            # 1. Load model and metadata
            model, model_doc = self._load_company_model(company_id)
            node_list = model_doc.get('node_list', [])
            if not node_list and model_doc.get('node_to_idx'):
                node_list = list(model_doc['node_to_idx'].keys())
            scalers = model_doc.get('scalers', {})
            max_timesteps = model_doc.get('architecture', {}).get('max_timesteps', 5)
            
            if self.debug:
                print(f"\n📊 Model Info:")
                print(f"  Type: {model_doc.get('model_type')}")
                print(f"  Nodes: {len(node_list)}")
                print(f"  Max timesteps: {max_timesteps}")
                print(f"  Has scalers: {len(scalers) > 0}")
                print(f"  Node list (first 10): {node_list[:10]}")
            
            # 2. Load company's REAL data
            sales_df, edges_df, nodes_df = self._load_company_data(company_id)
            
            # 3. Prepare REAL time series input from Sales Order data
            x = self._prepare_time_series_from_sales(sales_df, node_list, max_timesteps, scalers)
            
            # 4. Build edge index from Edges (Plant).csv
            edge_index = self._build_edge_index_from_edges(edges_df, node_list)
            
            if self.debug:
                print(f"\n🔧 Prepared model inputs:")
                print(f"  x shape: {x.shape}")
                print(f"  edge_index shape: {edge_index.shape}")
            
            # 5. Make prediction
            model.eval()
            with torch.no_grad():
                predictions = model(x, edge_index)
                
                if self.debug:
                    print(f"\n📈 Raw Predictions:")
                    print(f"  Shape: {predictions.shape}")
                    print(f"  Range: [{predictions.min().item():.4f}, {predictions.max().item():.4f}]")
                    print(f"  Mean: {predictions.mean().item():.4f}")
                    print(f"  Std: {predictions.std().item():.4f}")
                    
                    # Show first 5 predictions
                    print(f"\n  First 5 raw predictions:")
                    for i in range(min(5, len(predictions))):
                        print(f"    {node_list[i]}: {predictions[i].item():.4f}")
            
            # 6. Find requested product
            requested_product = None
            if isinstance(input_data, list) and len(input_data) > 0:
                requested_product = input_data[0].get('product', '')
            
            # 7. Extract and post-process specific prediction
            product_idx = None
            if requested_product:
                # Case-insensitive matching
                requested_upper = requested_product.strip().upper()
                for i, node in enumerate(node_list):
                    node_upper = node.strip().upper()
                    if requested_upper == node_upper or requested_upper in node_upper or node_upper in requested_upper:
                        product_idx = i
                        break
            
            recent_stats = None
            if product_idx is not None:
                recent_stats = self._recent_stats_for_product(sales_df, node_list[product_idx], max_timesteps)
            
            if product_idx is not None:
                final_prediction = float(predictions[product_idx].item())
                
                if self.debug:
                    print(f"\n✓ Found product match:")
                    print(f"  Requested: {requested_product}")
                    print(f"  Matched: {node_list[product_idx]}")
                    print(f"  Index: {product_idx}")
                    print(f"  Raw prediction: {final_prediction:.4f}")
                
                # Inverse transform if scalers were used
                if scalers and node_list[product_idx] in scalers:
                    scaler_data = scalers[node_list[product_idx]]
                    mean = np.array(scaler_data.get('mean_', [0.0]))
                    scale = np.array(scaler_data.get('scale_', [1.0]))
                    
                    # Inverse scaling: x_original = x_scaled * scale + mean
                    final_prediction = final_prediction * (scale[0] if scale.size else 1.0) + (mean[0] if mean.size else 0.0)
                    
                    if self.debug:
                        print(f"  Inverse scaled: {final_prediction:.4f} (mean={mean[0]:.2f}, scale={scale[0]:.2f})")
                    
                    # Calibration: adjust predictions based on recent trends
                    recent_mean = recent_stats.get('mean', 0.0) if recent_stats else 0.0
                    recent_max = recent_stats.get('max', 0.0) if recent_stats else 0.0
                    trend = recent_stats.get('trend', 'stable') if recent_stats else 'stable'
                    
                    # If prediction is way above recent max, cap it
                    upper_guard = max(recent_max * 1.5, recent_mean * 2.0, 100.0)
                    if upper_guard > 0 and final_prediction > upper_guard:
                        if self.debug:
                            print(f"  ⚠️ Calibrating high prediction {final_prediction:.2f} → {upper_guard:.2f}")
                        final_prediction = upper_guard
                    
                    # Light adjustment based on trend - only if prediction is clearly wrong
                    if recent_mean > 0:
                        if trend == 'down' and final_prediction > recent_mean * 1.2:
                            adjusted = recent_mean * 0.95
                            if self.debug:
                                print(f"  📉 Downward trend: slight adjustment {final_prediction:.2f} → {adjusted:.2f}")
                            final_prediction = adjusted
                        elif trend == 'up' and final_prediction < recent_mean * 0.8:
                            adjusted = recent_mean * 1.05
                            if self.debug:
                                print(f"  📈 Upward trend: slight adjustment {final_prediction:.2f} → {adjusted:.2f}")
                            final_prediction = adjusted
                
                if final_prediction < 0:
                    final_prediction = 0.0
            else:
                if requested_product:
                    if self.debug:
                        print(f"\n⚠️  Product '{requested_product}' not found in node list")
                        print(f"  Available nodes: {node_list[:10]}...")
                # Fallback to first node
                final_prediction = float(predictions[0].item())
                if scalers and node_list[0] in scalers:
                    scaler_data = scalers[node_list[0]]
                    mean = np.array(scaler_data.get('mean_', [0.0]))
                    scale = np.array(scaler_data.get('scale_', [1.0]))
                    final_prediction = final_prediction * (scale[0] if scale.size else 1.0) + (mean[0] if mean.size else 0.0)
                final_prediction = max(0, final_prediction)
                recent_stats = self._recent_stats_for_product(sales_df, node_list[0], max_timesteps)
            
            # Ensure prediction is positive
            final_prediction = max(0, final_prediction)
            
            if not recent_stats:
                recent_stats = {'mean': final_prediction, 'max': final_prediction, 'trend': 'stable'}
            
            try:
                forecast_days = int(forecast_days or 1)
            except (TypeError, ValueError):
                forecast_days = 1
            forecast_days = max(1, min(forecast_days, 30))
            
            forecast_series = None
            if forecast_days > 1:
                forecast_series = self._generate_forecast_series(final_prediction, recent_stats, forecast_days)
            
            # Calculate confidence based on prediction variance
            pred_std = predictions.std().item()
            if pred_std < 0.01:
                confidence = 60  # Low confidence for low variance
            elif pred_std < 0.1:
                confidence = 75
            else:
                confidence = 85
            
            result = {
                'company_id': company_id,
                'confidence': confidence,
                'requested_product': requested_product,
                'matched_node': node_list[product_idx] if product_idx is not None else None,
                'model_type': 'GAT-LSTM Hybrid',
                'input_shape': list(x.shape),
                'prediction_stats': {
                    'min': round(float(predictions.min().item()), 4),
                    'max': round(float(predictions.max().item()), 4),
                    'mean': round(float(predictions.mean().item()), 4),
                    'std': round(float(predictions.std().item()), 4)
                },
                'timestamp': pd.Timestamp.now().isoformat(),
                'forecast_days': forecast_days
            }
            
            if forecast_series:
                total_forecast = sum(forecast_series)
                result['prediction'] = [round(v, 2) for v in forecast_series]
                result['average_daily'] = round(total_forecast / forecast_days, 2)
                result['total_30_days'] = round(total_forecast, 2)
                result['prediction_series'] = result['prediction']
                result['rawPredicted'] = round(max(forecast_series), 2)
            else:
                result['prediction'] = [round(final_prediction, 2)]
                result['average_daily'] = round(final_prediction, 2)
                result['total_30_days'] = round(final_prediction * min(forecast_days, 30), 2)
                result['rawPredicted'] = round(final_prediction, 2)
            
            if self.debug:
                print(f"\n✅ FINAL PREDICTION: {final_prediction:.2f}")
                print(f"   Confidence: {confidence}%")
                print(f"{'='*60}\n")
            
            return result
            
        except Exception as e:
            print(f"\n✗ Error generating prediction: {e}")
            import traceback
            traceback.print_exc()
            raise