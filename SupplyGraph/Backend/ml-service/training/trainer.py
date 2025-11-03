import os
import pickle
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GATConv
from torch_geometric.data import Data
from sklearn.preprocessing import StandardScaler
from pymongo import MongoClient

class HybridGATLSTM(nn.Module):
    def __init__(self, in_channels=1, max_timesteps=5, gat_hidden=4, gat_heads=6, lstm_hidden=64, dropout=0.5):
        super(HybridGATLSTM, self).__init__()
        self.max_timesteps = max_timesteps
        self.lstm = nn.LSTM(in_channels, lstm_hidden, num_layers=2, bidirectional=True, batch_first=True, dropout=dropout)
        lstm_out_dim = lstm_hidden * 2
        self.conv1 = GATConv(lstm_out_dim, gat_hidden, heads=gat_heads, dropout=dropout)
        self.conv2 = GATConv(gat_hidden * gat_heads, gat_hidden, heads=gat_heads, dropout=dropout)
        self.lin = nn.Linear(gat_hidden * gat_heads, 1)
        self.dropout = dropout

    def forward(self, x, edge_index):
        # x: (num_nodes, max_timesteps, in_channels)
        if self.training and hasattr(self, 'noise_enabled') and self.noise_enabled():
            x = x + torch.randn_like(x) * 0.1
        x, _ = self.lstm(x)
        x = x[:, -1, :]  # Take last timestep output
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv1(x, edge_index)
        x = F.elu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv2(x, edge_index)
        x = F.elu(x)
        x = self.lin(x)
        return x

    def noise_enabled(self):
        return True

 

class ModelTrainer:
    def __init__(self):
        self.mongo_uri = "mongodb+srv://akifaliparvez:Akifmongo1@cluster0.lg4jnnj.mongodb.net/supplychain?retryWrites=true&w=majority"
        self.client = None
        self.db = None
        self.training_status = {}  # In-memory status tracking
        self._connect_mongo()
    
    def _connect_mongo(self):
        try:
            self.client = MongoClient(self.mongo_uri, 
                                    tls=True,
                                    tlsAllowInvalidCertificates=True,
                                    serverSelectionTimeoutMS=30000)
            self.db = self.client.supplychain
            print("Connected to MongoDB Atlas")
        except Exception as e:
            print(f"Failed to connect to MongoDB: {e}")
            self.client = None
            self.db = None
    
    def _load_base_model(self):
        """Load pre-trained GAT+LSTM base model from MongoDB Atlas"""
        try:
            print("Checking MongoDB connection...")
            if self.db is None:
                raise Exception("MongoDB connection not available")
            
            print("Searching for GAT+LSTM base model in database...")
            base_model_doc = self.db.models.find_one({"_id": "base_gat_lstm_model"})
            
            if not base_model_doc:
                print("No GAT+LSTM base model found in database, creating fallback model...")
                raise Exception("GAT+LSTM base model not found in MongoDB Atlas")
            
            print("Loading GAT+LSTM model data from database...")
            
            # Handle GridFS storage
            if base_model_doc.get('model_storage', {}).get('type') == 'gridfs':
                print("Loading model from GridFS...")
                import gridfs
                fs = gridfs.GridFS(self.db)
                file_id = base_model_doc['model_storage']['file_id']
                
                try:
                    from bson import ObjectId
                    grid_file = fs.get(ObjectId(file_id))
                    model_bytes = grid_file.read()
                    model_state = pickle.loads(model_bytes)
                    print(f"✓ Loaded model from GridFS: {len(model_bytes) / (1024*1024):.2f} MB")
                except Exception as gridfs_error:
                    print(f"GridFS loading failed: {gridfs_error}")
                    raise Exception("Failed to load model from GridFS")
            else:
                # Handle embedded storage
                if 'model_storage' in base_model_doc and 'model_bytes' in base_model_doc['model_storage']:
                    model_state = pickle.loads(base_model_doc['model_storage']['model_bytes'])
                else:
                    # Fallback for old format
                    model_state = pickle.loads(base_model_doc.get('model_data', b''))
            
            # Load GAT+LSTM model
            print("Loading GAT+LSTM Hybrid model...")
            architecture = base_model_doc['architecture']
            
            model = HybridGATLSTM(
                in_channels=1,
                max_timesteps=architecture['max_timesteps'],
                gat_hidden=architecture['gat_hidden'],
                gat_heads=architecture['gat_heads'],
                lstm_hidden=architecture['lstm_hidden'],
                dropout=architecture['dropout']
            )
            
            # Load model weights
            model.load_state_dict(model_state)
            
            print(f"Loaded GAT+LSTM model with {len(base_model_doc['node_list'])} nodes")
            return model, base_model_doc['node_list'], base_model_doc['scalers'], base_model_doc['node_to_idx']
            
        except Exception as e:
            print(f"Error loading base model: {e}")
            print("Creating new GAT+LSTM model from scratch as fallback")
            # Create a GAT+LSTM model with default dimensions
            fallback_model = HybridGATLSTM(
                in_channels=1,
                max_timesteps=5,
                gat_hidden=4,
                gat_heads=6,
                lstm_hidden=64,
                dropout=0.5
            )
            print(f"Created fallback GAT+LSTM model")
            return fallback_model, [], {}, {}
    
    def _validate_csv_data(self, nodes, edges, demand):
        """Validate CSV data for GAT+LSTM time series format"""
        errors = []
        
        # Check required columns
        required_nodes_cols = ['node_id']
        required_edges_cols = ['source_id', 'target_id']
        required_demand_cols = ['node_id']  # Updated for new format
        
        missing_nodes = [col for col in required_nodes_cols if col not in nodes.columns]
        missing_edges = [col for col in required_edges_cols if col not in edges.columns]
        missing_demand = [col for col in required_demand_cols if col not in demand.columns]
        
        if missing_nodes:
            errors.append(f"Nodes CSV missing columns: {missing_nodes}")
        if missing_edges:
            errors.append(f"Edges CSV missing columns: {missing_edges}")
        if missing_demand:
            errors.append(f"Demand CSV missing columns: {missing_demand}")
        
        # Check for time series columns (t1, t2, t3, etc.) OR long-format (date-based) data
        time_columns = [col for col in demand.columns if col.startswith('t') and col[1:].isdigit()]
        has_long_format = False
        if not time_columns:
            # Detect long format: requires a date-like column and a demand-like value column
            lower_cols = {c.lower(): c for c in demand.columns}
            date_col_name = None
            for candidate in ['date', 'timestamp']:
                if candidate in lower_cols:
                    date_col_name = lower_cols[candidate]
                    break
            value_col_name = None
            for candidate in ['demand', 'sales', 'value', 'quantity']:
                if candidate in lower_cols:
                    value_col_name = lower_cols[candidate]
                    break
            if date_col_name and value_col_name:
                has_long_format = True
            else:
                errors.append("Demand CSV must contain either time series columns (t1,t2,...) or long format with [date,demand]")
        
        # Check data consistency
        if len(nodes) == 0:
            errors.append("Nodes CSV is empty")
        if len(edges) == 0:
            errors.append("Edges CSV is empty")
        if len(demand) == 0:
            errors.append("Demand CSV is empty")
        
        # Check if edge nodes exist in nodes CSV
        if not missing_nodes and not missing_edges:
            node_ids = set(nodes['node_id'])
            edge_sources = set(edges['source_id'])
            edge_targets = set(edges['target_id'])
            
            missing_sources = edge_sources - node_ids
            missing_targets = edge_targets - node_ids
            
            if missing_sources:
                errors.append(f"Edge sources not found in nodes: {list(missing_sources)[:5]}...")
            if missing_targets:
                errors.append(f"Edge targets not found in nodes: {list(missing_targets)[:5]}...")
        
            # Check if demand nodes exist in nodes CSV (updated for both formats)
        if not missing_nodes and not missing_demand:
            demand_node_ids = set(demand['node_id'])
            missing_nodes_in_demand = demand_node_ids - set(nodes['node_id'])
            if missing_nodes_in_demand:
                errors.append(f"Demand nodes not found in nodes: {list(missing_nodes_in_demand)[:5]}...")
        
        return errors

    def _prepare_training_data(self, nodes_path, edges_path, demand_path):
        """Prepare training data from CSV files"""
        try:
            # Load CSV files
            print("Loading CSV files...")
            nodes = pd.read_csv(nodes_path)
            edges = pd.read_csv(edges_path)
            demand = pd.read_csv(demand_path)
            
            print(f"Loaded: {len(nodes)} nodes, {len(edges)} edges, {len(demand)} demand records")
            
            # Validate data
            print("Validating data consistency...")
            validation_errors = self._validate_csv_data(nodes, edges, demand)
            if validation_errors:
                error_msg = "Data validation failed:\n" + "\n".join(validation_errors)
                print(f"VALIDATION ERRORS:\n{error_msg}")
                raise ValueError(error_msg)
            
            # Create node mapping
            node_to_idx = {node_id: idx for idx, node_id in enumerate(nodes['node_id'])}
            
            # Prepare features
            feature_cols = [col for col in nodes.columns if col != 'node_id']
            features = []
            expanded_feature_columns = []  # exact column names used to build the final feature matrix
            
            for col in feature_cols:
                if nodes[col].dtype == 'object':
                    # One-hot encode categorical and record expanded column names
                    dummies = pd.get_dummies(nodes[col], prefix=col)
                    features.append(dummies.values)
                    expanded_feature_columns.extend(list(dummies.columns))
                else:
                    # Normalize numerical
                    col_values = nodes[col].values.astype(float)
                    normalized = (col_values - col_values.mean()) / (col_values.std() + 1e-8)
                    features.append(normalized.reshape(-1, 1))
                    expanded_feature_columns.append(col)
            
            # Stack features properly - ensure all features have the same number of rows
            if features:
                try:
                    # Check if all features have the same number of rows
                    feature_lengths = [f.shape[0] for f in features]
                    if len(set(feature_lengths)) > 1:
                        print(f"Warning: Feature lengths don't match: {feature_lengths}")
                        # Pad shorter features or truncate longer ones
                        min_length = min(feature_lengths)
                        padded_features = []
                        for f in features:
                            if f.shape[0] > min_length:
                                padded_features.append(f[:min_length])
                            else:
                                padded_features.append(f)
                        features = padded_features
                    
                    x = np.hstack(features)
                    print(f"Features stacked successfully: {x.shape}")
                except Exception as e:
                    print(f"Error stacking features: {e}")
                    # Fallback: create simple features
                    # Fallback: create simple numeric features and names
                    x = np.zeros((len(nodes), len(feature_cols)))
                    expanded_feature_columns = []
                    for i, col in enumerate(feature_cols):
                        if nodes[col].dtype == 'object':
                            x[:, i] = 0  # Default value for categorical
                            expanded_feature_columns.append(f"{col}_unknown")
                        else:
                            col_values = nodes[col].values.astype(float)
                            x[:, i] = (col_values - col_values.mean()) / (col_values.std() + 1e-8)
                            expanded_feature_columns.append(col)
            else:
                # Fallback if no features
                x = np.zeros((len(nodes), 1))
                expanded_feature_columns = ["feature_0"]
            
            # Prepare edges
            edge_source = [node_to_idx.get(source, 0) for source in edges['source_id']]
            edge_target = [node_to_idx.get(target, 0) for target in edges['target_id']]
            valid_edges = [(s, t) for s, t in zip(edge_source, edge_target) if s != 0 and t != 0]
            
            if valid_edges:
                edge_index = torch.tensor(valid_edges, dtype=torch.long).t().contiguous()
            else:
                edge_index = torch.tensor([[0, 1], [1, 2]], dtype=torch.long).t().contiguous()
            
            # Prepare targets - handle both old demand format and new sales format
            y = np.zeros(len(nodes))
            store_nodes_found = 0
            
            print(f"Processing {len(demand)} sales/demand records...")
            
            # Check if we have time series sales data (t1, t2, t3, etc.)
            time_columns = [col for col in demand.columns if col.startswith('t') and col[1:].isdigit()]
            
            # Prefer long-format if present to match base-model preprocessing
            lower_cols_pref = {c.lower(): c for c in demand.columns}
            prefer_date_col = None
            for candidate in ['date', 'timestamp']:
                if candidate in lower_cols_pref:
                    prefer_date_col = lower_cols_pref[candidate]
                    break
            prefer_value_col = None
            for candidate in ['demand', 'sales', 'value', 'quantity']:
                if candidate in lower_cols_pref:
                    prefer_value_col = lower_cols_pref[candidate]
                    break
            
            if time_columns and not (prefer_date_col and prefer_value_col):
                print(f"Found time series sales data with columns: {time_columns}")
                # New format: node_id, type, t1, t2, t3, etc.
                for _, row in demand.iterrows():
                    node_id = row.get('node_id', '')
                    
                    # Calculate average sales across time periods
                    sales_values = []
                    for col in time_columns:
                        try:
                            val = float(row[col])
                            if not pd.isna(val) and val > 0:
                                sales_values.append(val)
                        except (ValueError, TypeError):
                            continue
                    
                    if sales_values:
                        avg_sales = sum(sales_values) / len(sales_values)
                        
                        # Find matching node
                        matching_nodes = nodes[nodes['node_id'] == node_id]
                        if len(matching_nodes) > 0:
                            node_idx = matching_nodes.index[0]
                            y[node_idx] = avg_sales
                            store_nodes_found += 1
                            print(f"  Mapped node {node_id} -> index {node_idx}, avg sales: {avg_sales:.2f}")
                        else:
                            print(f"  WARNING: Node {node_id} not found in nodes")
            else:
                # Attempt to handle long-format date-based demand data: columns [node_id, date, demand]
                lower_cols = {c.lower(): c for c in demand.columns}
                date_col_name = None
                for candidate in ['date', 'timestamp']:
                    if candidate in lower_cols:
                        date_col_name = lower_cols[candidate]
                        break
                value_col_name = None
                for candidate in ['demand', 'sales', 'value', 'quantity']:
                    if candidate in lower_cols:
                        value_col_name = lower_cols[candidate]
                        break
                if date_col_name and value_col_name:
                    print(f"Detected long-format demand data with date column '{date_col_name}' and value column '{value_col_name}'")
                    # Ensure date type and sort
                    try:
                        demand[date_col_name] = pd.to_datetime(demand[date_col_name])
                    except Exception:
                        pass
                    # Compute average demand per node for target y (use last available window later for x)
                    grouped = demand.groupby('node_id')
                    for node_id, grp in grouped:
                        try:
                            values = pd.to_numeric(grp[value_col_name], errors='coerce').dropna().values.tolist()
                            if values:
                                avg_sales = float(sum(values) / len(values))
                                matching_nodes = nodes[nodes['node_id'] == node_id]
                                if len(matching_nodes) > 0:
                                    node_idx = matching_nodes.index[0]
                                    y[node_idx] = avg_sales
                                    store_nodes_found += 1
                                    print(f"  Mapped node {node_id} -> index {node_idx}, avg demand: {avg_sales:.2f}")
                        except Exception:
                            continue
                    # Prepare time series_x from last max_timesteps per node
                    max_timesteps = min(10, max(1, grouped.apply(lambda g: len(g)).max() if len(demand) > 0 else 5))
                    time_series_x = np.zeros((len(nodes), max_timesteps, 1))
                    for node_id, grp in grouped:
                        grp_sorted = grp.sort_values(date_col_name)
                        values = pd.to_numeric(grp_sorted[value_col_name], errors='coerce').dropna().values
                        if len(values) == 0:
                            continue
                        seq = values[-max_timesteps:]
                        # left-pad if shorter than max_timesteps
                        if len(seq) < max_timesteps:
                            seq = np.pad(seq, (max_timesteps - len(seq), 0), mode='constant')
                        matching_nodes = nodes[nodes['node_id'] == node_id]
                        if len(matching_nodes) > 0:
                            node_idx = matching_nodes.index[0]
                            time_series_x[node_idx, :, 0] = seq
                else:
                    print("No time series columns found and no valid long-format [date,demand] columns detected")
                    raise ValueError("GAT+LSTM requires either columns t1,t2,... or long-format [node_id,date,demand]")
            
            print(f"Found {store_nodes_found} nodes with sales/demand data")
            
            # Ensure we have some non-zero targets
            non_zero_targets = np.count_nonzero(y)
            print(f"Non-zero targets: {non_zero_targets}")
            print(f"Target statistics: min={y.min():.2f}, max={y.max():.2f}, mean={y.mean():.2f}")
            
            y = torch.tensor(y, dtype=torch.float).unsqueeze(1)
            
            # For GAT+LSTM, we need time series data
            # Convert sales data to time series format
            if time_columns:
                print("Preparing time series data for GAT+LSTM...")
                # Create time series features (num_nodes, max_timesteps, 1)
                max_timesteps = min(len(time_columns), 10)  # Limit to 10 timesteps
                time_series_x = np.zeros((len(nodes), max_timesteps, 1))
                
                for _, row in demand.iterrows():
                    node_id = row.get('node_id', '')
                    matching_nodes = nodes[nodes['node_id'] == node_id]
                    
                    if len(matching_nodes) > 0:
                        node_idx = matching_nodes.index[0]
                        # Extract time series values
                        for t, col in enumerate(time_columns[:max_timesteps]):
                            try:
                                val = float(row[col])
                                if not pd.isna(val):
                                    time_series_x[node_idx, t, 0] = val
                            except (ValueError, TypeError):
                                continue
                
                # Create Data object with time series format
                data = Data(
                    x=torch.tensor(time_series_x, dtype=torch.float), 
                    edge_index=edge_index, 
                    y=y
                )
                data.max_timesteps = max_timesteps
                print(f"Created time series data: {time_series_x.shape}")
                # Prepare simple per-node scalers based on time series
                training_scalers = {}
                for node_id, idx in node_to_idx.items():
                    series_vals = time_series_x[idx, :, 0].reshape(-1, 1)
                    try:
                        scaler = StandardScaler().fit(series_vals)
                        training_scalers[node_id] = {
                            'mean_': scaler.mean_.tolist(),
                            'scale_': scaler.scale_.tolist()
                        }
                    except Exception:
                        training_scalers[node_id] = {
                            'mean_': [float(series_vals.mean())],
                            'scale_': [float(series_vals.std() if series_vals.std() != 0 else 1.0)]
                        }
                
            else:
                # Use the long-format path's constructed time_series_x
                data = Data(
                    x=torch.tensor(time_series_x, dtype=torch.float),
                    edge_index=edge_index,
                    y=y
                )
                data.max_timesteps = time_series_x.shape[1]
                # Prepare simple per-node scalers based on time series
                training_scalers = {}
                for node_id, idx in node_to_idx.items():
                    series_vals = time_series_x[idx, :, 0].reshape(-1, 1)
                    try:
                        scaler = StandardScaler().fit(series_vals)
                        training_scalers[node_id] = {
                            'mean_': scaler.mean_.tolist(),
                            'scale_': scaler.scale_.tolist()
                        }
                    except Exception:
                        training_scalers[node_id] = {
                            'mean_': [float(series_vals.mean())],
                            'scale_': [float(series_vals.std() if series_vals.std() != 0 else 1.0)]
                        }
            
            data.x_ids = torch.arange(len(nodes))
            
            # Find store nodes (nodes with non-zero demand)
            store_indices = np.where(y.squeeze() > 0)[0]
            data.y_store_ids = torch.tensor(store_indices)
            
            print(f"Store node indices for training: {store_indices}")
            print(f"Store node targets: {y[store_indices].squeeze().tolist()}")
            print(f"Data x shape: {data.x.shape}")
            
            # Persist training-time mappings for saving
            try:
                self._training_node_to_idx = node_to_idx
                # Convert back to StandardScaler-like dicts for predictor reconstruction
                self._training_scalers = {k: type('obj', (), {'mean_': np.array(v['mean_']), 'scale_': np.array(v['scale_'])}) for k, v in training_scalers.items()}
            except Exception:
                self._training_node_to_idx = node_to_idx
                self._training_scalers = None

            # Return data and the exact expanded feature column names used to build x
            return data, expanded_feature_columns
            
        except Exception as e:
            print(f"Error preparing training data: {e}")
            raise
    
    def _fine_tune_model(self, model, data, epochs=50, company_id=None):
        """Fine-tune the model on company data"""
        try:
            optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
            criterion = torch.nn.MSELoss()
            
            model.train()
            losses = []
            
            # Ensure y_store_ids exists and has valid indices
            if not hasattr(data, 'y_store_ids') or len(data.y_store_ids) == 0:
                print("❌ CRITICAL: No store nodes found for training!")
                print("This means your demand data doesn't match any nodes in the nodes file.")
                print("Check that store_id in demand.csv matches node_id in nodes.csv")
                raise ValueError("No store nodes found for training - check data consistency")
            
            print(f"Starting training with {len(data.y_store_ids)} store nodes...")
            
            for epoch in range(epochs):
                optimizer.zero_grad()
                
                # Forward pass
                out = model(data.x, data.edge_index)
                
                # Calculate loss only on store nodes
                store_indices = data.y_store_ids
                store_predictions = out[store_indices]
                store_targets = data.y[store_indices]
                
                loss = criterion(store_predictions, store_targets)
                
                # Backward pass
                loss.backward()
                optimizer.step()
                losses.append(loss.item())
                
                # Update progress
                if company_id:
                    progress = 50 + int((epoch + 1) / epochs * 40)  # 50-90% range
                    self._update_training_status(company_id, "training", progress, 
                                               f"Training epoch {epoch+1}/{epochs}, Loss: {loss.item():.4f}")
                
                # Detailed logging every 10 epochs
                if (epoch + 1) % 10 == 0:
                    print(f'Epoch {epoch+1:03d}, Loss: {loss.item():.4f}')
                    print(f'  Predictions: {store_predictions.squeeze().detach().numpy()[:5]}...')  # First 5
                    print(f'  Targets:     {store_targets.squeeze().numpy()[:5]}...')  # First 5
                    print(f'  Pred range:  [{store_predictions.min().item():.2f}, {store_predictions.max().item():.2f}]')
                
                # Early stopping if loss is very low
                if loss.item() < 1e-6:
                    print(f"Early stopping at epoch {epoch+1} - loss converged")
                    break
            
            return losses
            
        except Exception as e:
            print(f"Error during fine-tuning: {e}")
            raise
    
    def save_company_model_to_atlas(self, company_id, model, feature_columns, metrics, scalers=None, node_to_idx=None, last_x=None):
        """Save fine-tuned GAT+LSTM company model to MongoDB Atlas"""
        try:
            if self.db is None:
                raise Exception("MongoDB connection not available")
            
            # Only GAT+LSTM models supported
            if not isinstance(model, HybridGATLSTM):
                raise Exception("Only GAT+LSTM models are supported")
            
            # GAT+LSTM model format
            model_state = {k: v.cpu() for k, v in model.state_dict().items()}
            
            # Serialize scalers for prediction
            serializable_scalers = {}
            if scalers:
                for node, scaler in scalers.items():
                    serializable_scalers[node] = {
                        'mean_': scaler.mean_.tolist() if hasattr(scaler, 'mean_') else None,
                        'scale_': scaler.scale_.tolist() if hasattr(scaler, 'scale_') else None
                    }
            
            # Serialize model state
            model_bytes = pickle.dumps(model_state)
            model_size_mb = len(model_bytes) / (1024 * 1024)
            print(f"Company GAT+LSTM model size: {model_size_mb:.2f} MB")
            
            model_doc = {
                'company_id': company_id,
                'model_type': 'GAT-LSTM Hybrid',
                'base_model_id': 'base_gat_lstm_model',
                'architecture': {
                    'max_timesteps': getattr(model, 'max_timesteps', 5),
                    'gat_hidden': 4,  # Default values
                    'gat_heads': 6,
                    'lstm_hidden': 64,
                    'dropout': getattr(model, 'dropout', 0.5)
                },
                'node_list': list((node_to_idx or {}).keys()),
                'feature_columns': feature_columns,
                'node_to_idx': node_to_idx or {},
                'scalers': serializable_scalers,
                'metrics': metrics,
                'created_at': pd.Timestamp.now()
            }
            
            # Use GridFS for large models (>15MB)
            if model_size_mb > 15:
                print("Using GridFS for large company model...")
                import gridfs
                fs = gridfs.GridFS(self.db)
                
                # Delete old file if exists
                old_files = list(fs.find({"filename": f"company_{company_id}_model"}))
                for old_file in old_files:
                    fs.delete(old_file._id)
                    print(f"✓ Deleted old company model GridFS file: {old_file._id}")
                
                # Store model in GridFS
                file_id = fs.put(
                    model_bytes,
                    filename=f"company_{company_id}_model",
                    company_id=company_id,
                    upload_date=pd.Timestamp.now()
                )
                print(f"✓ Company model stored in GridFS with file_id: {file_id}")
                
                # Update metadata to reference GridFS
                model_doc['model_storage'] = {
                    'type': 'gridfs',
                    'file_id': str(file_id),
                    'size_mb': model_size_mb
                }
            else:
                print("Storing company model directly in document...")
                model_doc['model_storage'] = {
                    'type': 'embedded',
                    'model_bytes': model_bytes,
                    'size_mb': model_size_mb
                }
            
            self.db.company_models.update_one(
                {'company_id': company_id},
                {'$set': model_doc},
                upsert=True
            )
            
            print(f"GAT+LSTM company model saved to Atlas for company {company_id}")
            return True
            
        except Exception as e:
            print(f"Error saving company model: {e}")
            return False
    
    def fine_tune_company_model(self, company_id, nodes_path, edges_path, demand_path, force_retrain=False):
        """Complete fine-tuning pipeline for a company"""
        try:
            print(f"Starting fine-tuning for company {company_id}")
            print(f"Nodes path: {nodes_path}")
            print(f"Edges path: {edges_path}")
            print(f"Demand path: {demand_path}")
            
            # Initialize training status
            self._update_training_status(company_id, "starting", 0, "Initializing training process...")
            
            # Check if model already exists
            if not force_retrain:
                existing_model = self.check_company_model_exists(company_id)
                if existing_model.get("exists", False):
                    print(f"Model already exists for company {company_id}")
                    print(f"Model ID: {existing_model['model_id']}")
                    print(f"Created: {existing_model['created_at']}")
                    print(f"Final Loss: {existing_model.get('metrics', {}).get('final_loss', 'N/A')}")
                    
                    self._update_training_status(company_id, "completed", 100, "Model already exists and trained")
                    return True
            
            # Check if files exist
            self._update_training_status(company_id, "validating", 10, "Checking input files...")
            
            missing_files = []
            if not os.path.exists(nodes_path):
                missing_files.append(f"Nodes file: {nodes_path}")
            if not os.path.exists(edges_path):
                missing_files.append(f"Edges file: {edges_path}")
            if not os.path.exists(demand_path):
                missing_files.append(f"Demand file: {demand_path}")
            
            if missing_files:
                error_msg = "Missing required files:\n" + "\n".join(missing_files)
                print(f"ERROR: {error_msg}")
                self._update_training_status(company_id, "failed", 0, "File validation failed", error_msg)
                return False
            
            # Load base model
            self._update_training_status(company_id, "loading_model", 20, "Loading base model...")
            print("Loading base model...")
            try:
                model, node_list, scalers, node_to_idx = self._load_base_model()
                print("Base model loaded successfully")
            except Exception as e:
                error_msg = f"Failed to load base model: {str(e)}"
                print(f"ERROR: {error_msg}")
                self._update_training_status(company_id, "failed", 20, "Base model loading failed", error_msg)
                return False
            
            # Diagnose training data first
            self._update_training_status(company_id, "preparing_data", 30, "Diagnosing training data...")
            diagnosis = self.diagnose_training_data(nodes_path, edges_path, demand_path)
            
            if diagnosis.get('matching_stores', 0) == 0:
                error_msg = "No matching store IDs found between nodes and demand data"
                print(f"❌ CRITICAL ERROR: {error_msg}")
                self._update_training_status(company_id, "failed", 30, "Data validation failed", error_msg)
                return False
            
            # Prepare training data
            self._update_training_status(company_id, "preparing_data", 35, "Preparing and validating training data...")
            print("Preparing training data...")
            try:
                data, feature_columns = self._prepare_training_data(nodes_path, edges_path, demand_path)
                print(f"Training data prepared with {len(feature_columns)} features")
            except Exception as e:
                error_msg = f"Data preparation failed: {str(e)}"
                print(f"ERROR: {error_msg}")
                self._update_training_status(company_id, "failed", 35, "Data preparation failed", error_msg)
                return False
            
            # Model compatibility check (GAT+LSTM only)
            self._update_training_status(company_id, "checking_model", 40, "Checking model compatibility...")
            try:
                # For HybridGATLSTM, input to conv layers comes from LSTM output; data.x is (num_nodes, timesteps, 1)
                # No action needed here; proceed with the existing HybridGATLSTM model
                print("Using HybridGATLSTM model; no additional compatibility changes required")
            except Exception as e:
                print(f"Model compatibility check warning: {e}. Proceeding with existing HybridGATLSTM model")
            
            # Fine-tune model
            self._update_training_status(company_id, "training", 50, "Training model on company data...")
            print("Starting model fine-tuning...")
            try:
                losses = self._fine_tune_model(model, data, epochs=50, company_id=company_id)
                print(f"Fine-tuning completed with {len(losses)} epochs")
            except Exception as e:
                error_msg = f"Model training failed: {str(e)}"
                print(f"ERROR: {error_msg}")
                self._update_training_status(company_id, "failed", 50, "Model training failed", error_msg)
                return False
            
            # Calculate metrics
            self._update_training_status(company_id, "saving", 90, "Saving trained model...")
            metrics = {
                'final_loss': losses[-1] if losses else 0,
                'training_epochs': len(losses),
                'loss_history': losses
            }
            
            # Save fine-tuned model
            print("Saving fine-tuned model to Atlas...")
            try:
                # Get scalers and node mapping from training data preparation
                scalers = getattr(self, '_training_scalers', None)
                node_to_idx = getattr(self, '_training_node_to_idx', None)
                success = self.save_company_model_to_atlas(company_id, model, feature_columns, metrics, scalers, node_to_idx)
                
                if success:
                    self._update_training_status(company_id, "completed", 100, 
                                                f"Training completed successfully! Final loss: {losses[-1]:.4f}")
                    print(f"Fine-tuning completed successfully for company {company_id}")
                    return True
                else:
                    error_msg = "Failed to save model to database"
                    self._update_training_status(company_id, "failed", 90, "Model saving failed", error_msg)
                    print(f"Failed to save fine-tuned model for company {company_id}")
                    return False
            except Exception as e:
                error_msg = f"Error saving model: {str(e)}"
                self._update_training_status(company_id, "failed", 90, "Model saving failed", error_msg)
                print(f"ERROR: {error_msg}")
                return False
                
        except Exception as e:
            error_msg = f"Unexpected error during fine-tuning: {str(e)}"
            print(f"ERROR: {error_msg}")
            import traceback
            traceback.print_exc()
            self._update_training_status(company_id, "failed", 0, "Training failed", error_msg)
            return False
    
    def _update_training_status(self, company_id, status, progress=0, message="", error=None):
        """Update training status in memory"""
        self.training_status[company_id] = {
            "status": status,
            "progress": progress,
            "message": message,
            "error": error,
            "timestamp": pd.Timestamp.now().isoformat()
        }
        print(f"Training status updated for {company_id}: {status} ({progress}%) - {message}")

    def get_training_status(self, company_id):
        """Get training status for a company"""
        try:
            # Check in-memory status first (for active training)
            if company_id in self.training_status:
                return self.training_status[company_id]
            
            if self.db is None:
                return {"status": "database_unavailable", "progress": 0}
            
            # Check if company model exists (completed training)
            model_doc = self.db.company_models.find_one({'company_id': company_id})
            
            if model_doc:
                return {
                    "status": "completed",
                    "progress": 100,
                    "model_id": str(model_doc['_id']),
                    "created_at": model_doc.get('created_at', 'unknown'),
                    "message": "Model training completed successfully"
                }
            else:
                return {
                    "status": "not_found", 
                    "progress": 0,
                    "message": "No training found for this company"
                }
                
        except Exception as e:
            print(f"Error getting training status: {e}")
            return {"status": "error", "progress": 0, "message": str(e)}
    
    def check_company_model_exists(self, company_id):
        """Check if a fine-tuned model already exists for a company"""
        try:
            if self.db is None:
                return {"exists": False, "error": "Database connection unavailable"}
            
            model_doc = self.db.company_models.find_one({'company_id': company_id})
            
            if model_doc:
                return {
                    "exists": True,
                    "model_id": str(model_doc['_id']),
                    "model_type": model_doc.get('model_type', 'unknown'),
                    "created_at": model_doc.get('created_at', 'unknown'),
                    "metrics": model_doc.get('metrics', {}),
                    "feature_columns": model_doc.get('feature_columns', [])
                }
            else:
                return {"exists": False}
                
        except Exception as e:
            print(f"Error checking company model: {e}")
            return {"exists": False, "error": str(e)}

    def check_base_model_exists(self):
        """Check if the base model exists in the database"""
        try:
            if self.db is None:
                return {"exists": False, "error": "Database connection unavailable"}
            
            base_model_doc = self.db.models.find_one({"_id": "base_gat_lstm_model"})
            
            if base_model_doc:
                return {
                    "exists": True,
                    "model_id": str(base_model_doc['_id']),
                    "input_dim": base_model_doc.get('input_dim', 'unknown'),
                    "model_data_size": len(base_model_doc.get('model_data', b'')),
                    "created_at": base_model_doc.get('created_at', 'unknown')
                }
            else:
                return {"exists": False}
                
        except Exception as e:
            print(f"Error checking base model: {e}")
            return {"exists": False, "error": str(e)}

    def get_model_info(self, company_id):
        """Get model information for a company"""
        try:
            if self.db is None:
                return {"error": "Database connection unavailable"}
            
            model_doc = self.db.company_models.find_one({'company_id': company_id})
            
            if model_doc:
                return {
                    "company_id": company_id,
                    "model_type": model_doc.get('model_type', 'unknown'),
                    "base_model_id": model_doc.get('base_model_id', 'unknown'),
                    "metrics": model_doc.get('metrics', {}),
                    "feature_columns": model_doc.get('feature_columns', []),
                    "created_at": model_doc.get('created_at', 'unknown')
                }
            else:
                return {"error": "Model not found"}
                
        except Exception as e:
            print(f"Error getting model info: {e}")
            return {"error": str(e)}

    def diagnose_training_data(self, nodes_path, edges_path, demand_path):
        """Diagnose training data issues"""
        try:
            print("🔍 DIAGNOSING TRAINING DATA...")
            
            # Load data
            nodes = pd.read_csv(nodes_path)
            edges = pd.read_csv(edges_path)
            demand = pd.read_csv(demand_path)
            
            print(f"📊 DATA SUMMARY:")
            print(f"  Nodes: {len(nodes)} rows, columns: {list(nodes.columns)}")
            print(f"  Edges: {len(edges)} rows, columns: {list(edges.columns)}")
            print(f"  Demand: {len(demand)} rows, columns: {list(demand.columns)}")
            
            # Check node IDs
            node_ids = set(nodes['node_id'])
            print(f"  Node IDs (first 10): {list(node_ids)[:10]}")
            
            # Check demand node IDs (new format uses node_id, not store_id)
            demand_node_ids = set(demand['node_id'])
            print(f"  Demand Node IDs (first 10): {list(demand_node_ids)[:10]}")
            
            # Check overlap
            matching_nodes = node_ids.intersection(demand_node_ids)
            print(f"  Matching node IDs: {len(matching_nodes)} out of {len(demand_node_ids)}")
            print(f"  Matching IDs: {list(matching_nodes)[:10]}")
            
            # Check time series data (t1, t2, t3, etc.) or long format
            time_columns = [col for col in demand.columns if col.startswith('t') and col[1:].isdigit()]
            print(f"  Time series columns: {time_columns}")
            lower_cols = {c.lower(): c for c in demand.columns}
            date_col_name = None
            for candidate in ['date', 'timestamp']:
                if candidate in lower_cols:
                    date_col_name = lower_cols[candidate]
                    break
            value_col_name = None
            for candidate in ['demand', 'sales', 'value', 'quantity']:
                if candidate in lower_cols:
                    value_col_name = lower_cols[candidate]
                    break
            
            if time_columns:
                # Calculate average sales across time periods
                sales_values = []
                for _, row in demand.iterrows():
                    for col in time_columns:
                        try:
                            val = float(row[col])
                            if not pd.isna(val) and val > 0:
                                sales_values.append(val)
                        except (ValueError, TypeError):
                            continue
                
                if sales_values:
                    print(f"  Sales statistics:")
                    print(f"    Min: {min(sales_values):.2f}")
                    print(f"    Max: {max(sales_values):.2f}")
                    print(f"    Mean: {sum(sales_values)/len(sales_values):.2f}")
                    print(f"    Non-zero values: {len(sales_values)}")
            elif date_col_name and value_col_name:
                print(f"  Long-format detected with date column '{date_col_name}' and value column '{value_col_name}'")
                try:
                    demand[date_col_name] = pd.to_datetime(demand[date_col_name])
                except Exception:
                    pass
                sales_values = pd.to_numeric(demand[value_col_name], errors='coerce').dropna().tolist()
                if sales_values:
                    print(f"  Sales statistics (long format):")
                    print(f"    Min: {min(sales_values):.2f}")
                    print(f"    Max: {max(sales_values):.2f}")
                    print(f"    Mean: {sum(sales_values)/len(sales_values):.2f}")
                    print(f"    Non-zero values: {len([v for v in sales_values if v>0])}")
            
            return {
                'nodes_count': len(nodes),
                'demand_count': len(demand),
                'matching_stores': len(matching_nodes),  # Updated to use matching_nodes
                'time_columns': time_columns,
                'sales_stats': {
                    'min': float(min(sales_values)) if sales_values else 0,
                    'max': float(max(sales_values)) if sales_values else 0,
                    'mean': float(sum(sales_values)/len(sales_values)) if sales_values else 0,
                    'non_zero': len(sales_values) if sales_values else 0
                } if 'sales_values' in locals() and sales_values else {},
                'format': 'wide' if time_columns else ('long' if date_col_name and value_col_name else 'unknown')
            }
            
        except Exception as e:
            print(f"Error diagnosing data: {e}")
            return {"error": str(e)}

    def get_training_data_info(self, nodes_path, edges_path, demand_path):
        """Get information about the training data files"""
        try:
            info = {}
            
            # Check if files exist
            info['nodes_exists'] = os.path.exists(nodes_path)
            info['edges_exists'] = os.path.exists(edges_path)
            info['demand_exists'] = os.path.exists(demand_path)
            
            if info['nodes_exists']:
                import pandas as pd
                nodes = pd.read_csv(nodes_path)
                info['nodes_count'] = len(nodes)
                info['nodes_columns'] = list(nodes.columns)
                info['nodes_dtypes'] = {col: str(nodes[col].dtype) for col in nodes.columns}
            
            if info['edges_exists']:
                edges = pd.read_csv(edges_path)
                info['edges_count'] = len(edges)
                info['edges_columns'] = list(edges.columns)
            
            if info['demand_exists']:
                demand = pd.read_csv(demand_path)
                info['demand_count'] = len(demand)
                info['demand_columns'] = list(demand.columns)
            
            return info
            
        except Exception as e:
            return {"error": f"Error reading training data: {str(e)}"}