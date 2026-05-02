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
from sklearn.metrics import mean_absolute_percentage_error
from torch.optim.lr_scheduler import ReduceLROnPlateau
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
        # Use environment variable - credentials should NEVER be hardcoded
        self.mongo_uri = os.getenv('MONGO_URI')
        self.client = None
        self.db = None
        self.training_status = {}
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
            
            model.load_state_dict(model_state)
            
            print(f"Loaded GAT+LSTM model with {len(base_model_doc['node_list'])} nodes")
            return model, base_model_doc['node_list'], base_model_doc['scalers'], base_model_doc['node_to_idx']
            
        except Exception as e:
            print(f"Error loading base model: {e}")
            print("Creating new GAT+LSTM model from scratch as fallback")
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
    
    def _validate_csv_data(self, nodes, edges, sales):
        """Validate CSV data structure"""
        errors = []
        
        # Check nodes.csv structure
        if 'Node' not in nodes.columns:
            errors.append("nodes.csv missing 'Node' column")
        
        # Check edges.csv structure
        required_edge_cols = ['node1', 'node2']
        missing_edge_cols = [col for col in required_edge_cols if col not in edges.columns]
        if missing_edge_cols:
            errors.append(f"Edges CSV missing columns: {missing_edge_cols}")
        
        # Check sales.csv structure
        if 'Date' not in sales.columns:
            errors.append("Sales Order.csv missing 'Date' column")
        
        # Get product columns (all columns except Date)
        product_columns = [col for col in sales.columns if col != 'Date']
        if len(product_columns) == 0:
            errors.append("Sales Order.csv has no product columns")
        
        # Check data consistency
        if len(nodes) == 0:
            errors.append("Nodes CSV is empty")
        if len(edges) == 0:
            errors.append("Edges CSV is empty")
        if len(sales) == 0:
            errors.append("Sales Order CSV is empty")
        
        # Check if edge nodes exist in nodes CSV
        if 'Node' in nodes.columns and not missing_edge_cols:
            node_ids = set(nodes['Node'])
            edge_nodes = set(edges['node1']).union(set(edges['node2']))
            
            missing_nodes = edge_nodes - node_ids
            if missing_nodes:
                errors.append(f"Edge nodes not found in nodes.csv: {list(missing_nodes)[:5]}...")
        
        # Check if product columns exist as nodes
        if 'Node' in nodes.columns and product_columns:
            node_ids = set(nodes['Node'])
            missing_products = set(product_columns) - node_ids
            if missing_products:
                errors.append(f"Product columns not found as nodes: {list(missing_products)[:5]}...")
        
        return errors

    def _prepare_training_data(self, nodes_path, edges_path, sales_path):
        """Prepare training data using sliding-window approach (matches base model).
        
        Returns:
            train_datas, val_datas, test_datas: Lists of PyG Data objects
            scalers: Dict of StandardScaler per node (fit on training portion only)
            node_to_idx: Dict mapping node name to index
            edge_index: Tensor of graph edges
            node_list: List of node names
        """
        try:
            print("Loading CSV files...")
            nodes_df = pd.read_csv(nodes_path)
            edges_df = pd.read_csv(edges_path)
            sales_df = pd.read_csv(sales_path)
            
            print(f"Loaded: {len(nodes_df)} nodes, {len(edges_df)} edges, {len(sales_df)} sales records")
            
            # Auto-add missing edge nodes to nodes DataFrame
            if 'Node' in nodes_df.columns and 'node1' in edges_df.columns and 'node2' in edges_df.columns:
                node_ids = set(str(n) for n in nodes_df['Node'].dropna())
                edge_nodes = set(str(n) for n in edges_df['node1'].dropna() if pd.notna(n) and str(n).strip() != '')
                edge_nodes = edge_nodes.union(set(str(n) for n in edges_df['node2'].dropna() if pd.notna(n) and str(n).strip() != ''))
                missing_nodes = edge_nodes - node_ids
                
                if missing_nodes:
                    print(f"Auto-adding {len(missing_nodes)} missing edge nodes...")
                    new_nodes = []
                    for node in missing_nodes:
                        node_str = str(node).strip()
                        new_node = {'Node': node_str}
                        if 'Plant' in nodes_df.columns:
                            plant_val = ''
                            if 'Plant' in edges_df.columns:
                                plant_rows = edges_df[
                                    (edges_df['node1'].astype(str).str.strip() == node_str) | 
                                    (edges_df['node2'].astype(str).str.strip() == node_str)
                                ]
                                if len(plant_rows) > 0:
                                    plant_val = str(plant_rows.iloc[0].get('Plant', '')).strip()
                            new_node['Plant'] = plant_val if plant_val else ''
                        new_nodes.append(new_node)
                    new_nodes_df = pd.DataFrame(new_nodes)
                    nodes_df = pd.concat([nodes_df, new_nodes_df], ignore_index=True)
            
            # Validate data
            validation_errors = self._validate_csv_data(nodes_df, edges_df, sales_df)
            if validation_errors:
                error_msg = "Data validation failed:\n" + "\n".join(validation_errors)
                print(f"VALIDATION ERRORS:\n{error_msg}")
                raise ValueError(error_msg)
            
            # Sort sales by date
            sales_df['Date'] = pd.to_datetime(sales_df['Date'])
            sales_df = sales_df.sort_values('Date')
            product_columns = [col for col in sales_df.columns if col != 'Date']
            num_times = len(sales_df)
            print(f"Number of time steps (days): {num_times}")
            
            # Build node list — only keep nodes that have sales data with variance
            node_list = []
            series = []
            for node in nodes_df['Node']:
                node_str = str(node).strip()
                if node_str in product_columns:
                    node_series = pd.to_numeric(sales_df[node_str], errors='coerce').fillna(0.0).values
                    zero_prop = np.sum(node_series == 0) / len(node_series)
                    if np.std(node_series) > 0 and zero_prop < 0.9:
                        node_list.append(node_str)
                        series.append(node_series)
            
            if len(node_list) == 0:
                raise RuntimeError("No valid nodes found after filtering (need non-zero variance)")
            
            series = np.array(series)  # shape: (num_nodes, num_times)
            node_to_idx = {node: idx for idx, node in enumerate(node_list)}
            print(f"Valid nodes for training: {len(node_list)}")
            
            # Temporal split: 70% train, 20% val, 10% test
            train_end = int(0.7 * num_times)
            val_end = train_end + int(0.2 * num_times)
            
            # Fit scalers on TRAINING data only (no leakage)
            scalers = {}
            scaled_series = np.zeros_like(series, dtype=float)
            for i, node in enumerate(node_list):
                train_portion = series[i, :train_end]
                if np.std(train_portion) > 0:
                    scaler = StandardScaler().fit(train_portion.reshape(-1, 1))
                    scalers[node] = scaler
                    scaled_series[i] = scaler.transform(series[i].reshape(-1, 1)).flatten()
                else:
                    scalers[node] = StandardScaler()
                    scaled_series[i] = series[i]
            
            print(f"Scalers fit on training data only (first {train_end} of {num_times} timesteps)")
            
            # Build graph edges
            edge_list = []
            for _, row in edges_df.iterrows():
                node1 = str(row.get('node1', '')).strip()
                node2 = str(row.get('node2', '')).strip()
                if pd.isna(row.get('node1')) or pd.isna(row.get('node2')):
                    continue
                if node1 in node_to_idx and node2 in node_to_idx:
                    edge_list.append([node_to_idx[node1], node_to_idx[node2]])
            
            # Add Product-Plant edges
            if 'Plant' in nodes_df.columns:
                for _, row in nodes_df.iterrows():
                    node = str(row['Node']).strip()
                    plant = str(row.get('Plant', '')).strip()
                    if node in node_to_idx and plant in node_to_idx:
                        edge_list.append([node_to_idx[node], node_to_idx[plant]])
                        edge_list.append([node_to_idx[plant], node_to_idx[node]])
            
            if not edge_list:
                print("WARNING: No valid edges found, GAT will behave like LSTM")
                edge_list = [[0, 0]]
            
            edge_index = torch.tensor(edge_list, dtype=torch.long).t().contiguous()
            print(f"Created {len(edge_list)} edges")
            
            # Sliding window max_timesteps (use model default of 5)
            max_timesteps = min(5, train_end - 1)
            
            # Create sliding-window Data objects
            # For each timestep t: x = scaled_series[:, t-max_timesteps:t], y = scaled_series[:, t]
            def create_datas(start, end):
                datas = []
                for t in range(start, end):
                    x = torch.tensor(
                        scaled_series[:, t - max_timesteps: t], dtype=torch.float
                    ).unsqueeze(-1)  # (num_nodes, max_timesteps, 1)
                    y = torch.tensor(
                        scaled_series[:, t], dtype=torch.float
                    ).view(-1, 1)    # (num_nodes, 1)
                    datas.append(Data(x=x, edge_index=edge_index, y=y))
                return datas
            
            train_datas = create_datas(max_timesteps, train_end)
            val_datas = create_datas(max(train_end, max_timesteps), val_end)
            test_datas = create_datas(max(val_end, max_timesteps), num_times)
            print(f"Train windows: {len(train_datas)}, Val: {len(val_datas)}, Test: {len(test_datas)}")
            
            # Store for later use
            self._training_node_to_idx = node_to_idx
            self._training_scalers = scalers
            self._training_node_list = node_list
            self._training_edge_index = edge_index
            self._training_max_timesteps = max_timesteps
            
            # Store last window for prediction bootstrap
            last_x_raw = series[:, -max_timesteps:]  # (num_nodes, max_timesteps)
            last_x_scaled = np.zeros_like(last_x_raw, dtype=float)
            for i, node in enumerate(node_list):
                if node in scalers and hasattr(scalers[node], 'mean_'):
                    last_x_scaled[i] = scalers[node].transform(last_x_raw[i].reshape(-1, 1)).flatten()
                else:
                    last_x_scaled[i] = last_x_raw[i]
            self._last_x = torch.tensor(last_x_scaled, dtype=torch.float).unsqueeze(-1)  # (num_nodes, max_timesteps, 1)
            
            # Get feature columns for metadata
            feature_columns = node_list
            
            return train_datas, val_datas, test_datas, feature_columns
            
        except Exception as e:
            print(f"Error preparing training data: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    def _fine_tune_model(self, model, train_datas, val_datas, epochs=100, company_id=None):
        """Fine-tune the model using sliding-window approach (matches base model training)."""
        try:
            optimizer = torch.optim.Adam(model.parameters(), lr=0.001, weight_decay=5e-4)
            scheduler = ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=10)
            
            model.train()
            best_val_loss = float('inf')
            best_model_state = None
            wait = 0
            patience = 20
            train_losses = []
            
            if len(train_datas) == 0:
                raise ValueError("No training windows available")
            
            print(f"Starting fine-tuning: {len(train_datas)} train windows, {len(val_datas)} val windows")
            
            for epoch in range(1, epochs + 1):
                # Training loop
                model.train()
                total_loss = 0.0
                total_train_len = len(train_datas)
                for step, data in enumerate(train_datas):
                    optimizer.zero_grad()
                    out = model(data.x, data.edge_index)
                    loss = F.huber_loss(out, data.y, delta=1.0)
                    loss.backward()
                    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                    optimizer.step()
                    total_loss += loss.item()
                    
                    # Update progress in real-time within the epoch
                    if company_id and step % max(1, total_train_len // 5) == 0:
                        progress = 50.0 + ((epoch - 1) + (step / total_train_len)) / epochs * 40.0
                        self._update_training_status(company_id, "training", round(progress, 1),
                            f"Training Epoch {epoch}/{epochs} ({step}/{total_train_len})")
                
                train_loss = total_loss / len(train_datas)
                train_losses.append(train_loss)
                
                # Validation loop
                val_loss = 0.0
                val_mape = 0.0
                if val_datas:
                    model.eval()
                    with torch.no_grad():
                        for data in val_datas:
                            out = model(data.x, data.edge_index)
                            loss = F.huber_loss(out, data.y, delta=1.0)
                            val_loss += loss.item()
                            y_true_real = np.zeros(len(self._training_node_list))
                            y_pred_real = np.zeros(len(self._training_node_list))
                            
                            for i, node in enumerate(self._training_node_list):
                                scaler = self._training_scalers.get(node)
                                mean = scaler.mean_[0] if scaler and hasattr(scaler, 'mean_') else 0.0
                                scale = scaler.scale_[0] if scaler and hasattr(scaler, 'scale_') else 1.0
                                
                                y_true_real[i] = max(0, data.y[i].item() * scale + mean)
                                y_pred_real[i] = max(0, out[i].item() * scale + mean)
                                
                            mask = y_true_real > 0.1  # Avoid zero-division
                            if np.any(mask):
                                val_mape += mean_absolute_percentage_error(y_true_real[mask], y_pred_real[mask])
                    val_loss /= len(val_datas)
                    val_mape /= len(val_datas)
                    scheduler.step(val_loss)
                
                # Update progress at end of epoch with metrics
                if company_id:
                    progress = 50.0 + (epoch / epochs) * 40.0
                    self._update_training_status(company_id, "training", round(progress, 1),
                        f"Epoch {epoch}/{epochs}, Train: {train_loss:.4f}, Val: {val_loss:.4f}, MAPE: {val_mape:.2%}")
                
                if epoch % 10 == 0 or epoch == 1:
                    print(f"Epoch {epoch:03d} | Train: {train_loss:.4f} | Val: {val_loss:.4f} | MAPE: {val_mape:.2%}")
                
                # Early stopping on validation loss
                if val_datas and val_loss < best_val_loss:
                    best_val_loss = val_loss
                    wait = 0
                    best_model_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
                else:
                    wait += 1
                    if wait >= patience:
                        print(f"Early stopping at epoch {epoch}")
                        break
            
            # Restore best model
            if best_model_state is not None:
                model.load_state_dict(best_model_state)
                print(f"Restored best model (val_loss={best_val_loss:.4f})")
            
            return train_losses, best_val_loss, val_mape
            
        except Exception as e:
            print(f"Error during fine-tuning: {e}")
            raise
    
    def save_company_model_to_atlas(self, company_id, model, feature_columns, metrics, scalers=None, node_to_idx=None, last_x=None, max_timesteps=5):
        """Save fine-tuned model to MongoDB Atlas"""
        try:
            if self.db is None:
                raise Exception("MongoDB connection not available")
            
            if not isinstance(model, HybridGATLSTM):
                raise Exception("Only GAT+LSTM models are supported")
            
            model_state = {k: v.cpu() for k, v in model.state_dict().items()}
            
            serializable_scalers = {}
            if scalers:
                for node, scaler in scalers.items():
                    serializable_scalers[node] = {
                        'mean_': scaler.mean_.tolist() if hasattr(scaler, 'mean_') else None,
                        'scale_': scaler.scale_.tolist() if hasattr(scaler, 'scale_') else None
                    }
            
            model_bytes = pickle.dumps(model_state)
            model_size_mb = len(model_bytes) / (1024 * 1024)
            print(f"Company model size: {model_size_mb:.2f} MB")
            
            model_doc = {
                'company_id': company_id,
                'model_type': 'GAT-LSTM Hybrid',
                'base_model_id': 'base_gat_lstm_model',
                'architecture': {
                    'max_timesteps': max_timesteps,
                    'gat_hidden': 4,
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
            
            # Store last_x for prediction bootstrap
            if last_x is not None:
                model_doc['last_x'] = last_x.numpy().tolist()
            
            # Use GridFS for large models
            if model_size_mb > 15:
                print("Using GridFS for large model...")
                import gridfs
                fs = gridfs.GridFS(self.db)
                
                old_files = list(fs.find({"filename": f"company_{company_id}_model"}))
                for old_file in old_files:
                    fs.delete(old_file._id)
                
                file_id = fs.put(
                    model_bytes,
                    filename=f"company_{company_id}_model",
                    company_id=company_id,
                    upload_date=pd.Timestamp.now()
                )
                
                model_doc['model_storage'] = {
                    'type': 'gridfs',
                    'file_id': str(file_id),
                    'size_mb': model_size_mb
                }
            else:
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
            
            print(f"Model saved to Atlas for company {company_id}")
            return True
            
        except Exception as e:
            print(f"Error saving model: {e}")
            return False
    
    def fine_tune_company_model(self, company_id, nodes_path, edges_path, sales_path, force_retrain=False):
        """Complete fine-tuning pipeline"""
        try:
            action = "retraining" if force_retrain else "training"
            print(f"Starting {action} for company {company_id} (force_retrain={force_retrain})")
            self._update_training_status(company_id, "starting", 0, f"Initializing {'re' if force_retrain else ''}training...")
            
            # Check existing model — skipped entirely when force_retrain=True
            if not force_retrain:
                existing_model = self.check_company_model_exists(company_id)
                if existing_model.get("exists", False):
                    print(f"Model already exists for company {company_id}. Use force_retrain=True to retrain.")
                    self._update_training_status(company_id, "completed", 100, "Model already trained (use Force Retrain to retrain)")
                    return True
            
            # Validate files
            self._update_training_status(company_id, "validating", 10, "Checking files...")
            missing_files = []
            for label, path in [("Nodes", nodes_path), ("Edges", edges_path), ("Sales", sales_path)]:
                if not os.path.exists(path):
                    missing_files.append(f"{label}: {path}")
            if missing_files:
                error_msg = "Missing files:\n" + "\n".join(missing_files)
                self._update_training_status(company_id, "failed", 0, "File validation failed", error_msg)
                return False
            
            # Load base model
            self._update_training_status(company_id, "loading_model", 20, "Loading base model...")
            model, _, _, _ = self._load_base_model()
            
            # When force-retraining, reset the output head so the model starts
            # predicting from a neutral distribution rather than carrying over
            # stale biases that produce 100k+ outputs on new data.
            if force_retrain:
                import torch.nn as nn
                nn.init.xavier_uniform_(model.lin.weight)
                nn.init.zeros_(model.lin.bias)
                print("Output head re-initialized for fresh fine-tuning")
            
            # Prepare data (sliding-window approach)
            self._update_training_status(company_id, "preparing_data", 30, "Preparing training data...")
            train_datas, val_datas, test_datas, feature_columns = self._prepare_training_data(
                nodes_path, edges_path, sales_path
            )
            
            # Fine-tune with proper training loop
            self._update_training_status(company_id, "training", 50, "Training model...")
            train_losses, best_val_loss, val_mape = self._fine_tune_model(
                model, train_datas, val_datas, epochs=100, company_id=company_id
            )
            
            # Evaluate on test set
            test_loss = 0.0
            test_mape = 0.0
            if test_datas:
                model.eval()
                with torch.no_grad():
                    for data in test_datas:
                        out = model(data.x, data.edge_index)
                        loss = F.huber_loss(out, data.y, delta=1.0)
                        test_loss += loss.item()
                        y_true_real = np.zeros(len(self._training_node_list))
                        y_pred_real = np.zeros(len(self._training_node_list))
                        
                        for i, node in enumerate(self._training_node_list):
                            scaler = self._training_scalers.get(node)
                            mean = scaler.mean_[0] if scaler and hasattr(scaler, 'mean_') else 0.0
                            scale = scaler.scale_[0] if scaler and hasattr(scaler, 'scale_') else 1.0
                            
                            y_true_real[i] = max(0, data.y[i].item() * scale + mean)
                            y_pred_real[i] = max(0, out[i].item() * scale + mean)
                            
                        mask = y_true_real > 0.1
                        if np.any(mask):
                            test_mape += mean_absolute_percentage_error(y_true_real[mask], y_pred_real[mask])
                test_loss /= len(test_datas)
                test_mape /= len(test_datas)
                print(f"Test Loss: {test_loss:.4f}, Test MAPE: {test_mape:.2%}")
            
            # Save model
            self._update_training_status(company_id, "saving", 90, "Saving model...")
            metrics = {
                'final_train_loss': train_losses[-1] if train_losses else 0,
                'best_val_loss': best_val_loss,
                'val_mape': val_mape,
                'test_loss': test_loss,
                'test_mape': test_mape,
                'training_epochs': len(train_losses),
                'loss_history': train_losses[-20:]  # Last 20 to keep doc small
            }
            
            scalers = getattr(self, '_training_scalers', None)
            node_to_idx = getattr(self, '_training_node_to_idx', None)
            last_x = getattr(self, '_last_x', None)
            max_timesteps = getattr(self, '_training_max_timesteps', 5)
            
            success = self.save_company_model_to_atlas(
                company_id, model, feature_columns, metrics,
                scalers, node_to_idx, last_x, max_timesteps
            )
            
            if success:
                self._update_training_status(company_id, "completed", 100,
                    f"Training completed! Val MAPE: {val_mape:.2%}, Test MAPE: {test_mape:.2%}")
                return True
            else:
                self._update_training_status(company_id, "failed", 90, "Model saving failed")
                return False
                
        except Exception as e:
            error_msg = f"Training failed: {str(e)}"
            print(f"ERROR: {error_msg}")
            import traceback
            traceback.print_exc()
            self._update_training_status(company_id, "failed", 0, "Training failed", error_msg)
            return False
    
    def _update_training_status(self, company_id, status, progress=0, message="", error=None):
        """Update training status"""
        self.training_status[company_id] = {
            "status": status,
            "progress": progress,
            "message": message,
            "error": error,
            "timestamp": pd.Timestamp.now().isoformat()
        }
        print(f"Status [{company_id}]: {status} ({progress}%) - {message}")

    def get_training_status(self, company_id):
        """Get training status"""
        try:
            if company_id in self.training_status:
                return self.training_status[company_id]
            
            if self.db is None:
                return {"status": "database_unavailable", "progress": 0}
            
            model_doc = self.db.company_models.find_one({'company_id': company_id})
            
            if model_doc:
                return {
                    "status": "completed",
                    "progress": 100,
                    "model_id": str(model_doc['_id']),
                    "created_at": model_doc.get('created_at', 'unknown'),
                    "message": "Model training completed"
                }
            else:
                return {
                    "status": "not_found", 
                    "progress": 0,
                    "message": "No training found"
                }
                
        except Exception as e:
            return {"status": "error", "progress": 0, "message": str(e)}
    
    def check_company_model_exists(self, company_id):
        """Check if model exists"""
        try:
            if self.db is None:
                return {"exists": False, "error": "Database unavailable"}
            
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
            return {"exists": False, "error": str(e)}

    def check_base_model_exists(self):
        """Check if base model exists"""
        try:
            if self.db is None:
                return {"exists": False, "error": "Database unavailable"}
            
            base_model_doc = self.db.models.find_one({"_id": "base_gat_lstm_model"})
            
            if base_model_doc:
                return {
                    "exists": True,
                    "model_id": str(base_model_doc['_id']),
                    "created_at": base_model_doc.get('created_at', 'unknown')
                }
            else:
                return {"exists": False}
                
        except Exception as e:
            return {"exists": False, "error": str(e)}

    def diagnose_training_data(self, nodes_path, edges_path, sales_path):
        """Diagnose training data"""
        try:
            print("🔍 DIAGNOSING TRAINING DATA...")
            
            nodes = pd.read_csv(nodes_path)
            edges = pd.read_csv(edges_path)
            sales = pd.read_csv(sales_path)
            
            print(f"📊 DATA SUMMARY:")
            print(f"  Nodes: {len(nodes)} rows, columns: {list(nodes.columns)}")
            print(f"  Edges: {len(edges)} rows, columns: {list(edges.columns)}")
            print(f"  Sales: {len(sales)} rows, columns: {list(sales.columns)}")
            
            node_list = nodes['Node'].tolist() if 'Node' in nodes.columns else []
            product_columns = [col for col in sales.columns if col != 'Date']
            
            print(f"  Nodes (first 10): {node_list[:10]}")
            print(f"  Products (first 10): {product_columns[:10]}")
            
            matching_products = set(node_list).intersection(set(product_columns))
            print(f"  Matching products: {len(matching_products)} out of {len(product_columns)}")
            
            if 'Date' in sales.columns:
                sales['Date'] = pd.to_datetime(sales['Date'])
                print(f"  Date range: {sales['Date'].min()} to {sales['Date'].max()}")
                print(f"  Time periods: {len(sales)}")
            
            # Calculate sales statistics
            sales_values = []
            for col in product_columns:
                if col in sales.columns:
                    vals = pd.to_numeric(sales[col], errors='coerce').dropna().values
                    sales_values.extend(vals[vals > 0])
            
            if sales_values:
                print(f"  Sales statistics:")
                print(f"    Min: {min(sales_values):.2f}")
                print(f"    Max: {max(sales_values):.2f}")
                print(f"    Mean: {sum(sales_values)/len(sales_values):.2f}")
                print(f"    Non-zero values: {len(sales_values)}")
            
            return {
                'nodes_count': len(nodes),
                'edges_count': len(edges),
                'sales_count': len(sales),
                'matching_products': len(matching_products),
                'product_columns': product_columns[:20],  # First 20
                'time_periods': len(sales),
                'sales_stats': {
                    'min': float(min(sales_values)) if sales_values else 0,
                    'max': float(max(sales_values)) if sales_values else 0,
                    'mean': float(sum(sales_values)/len(sales_values)) if sales_values else 0,
                    'non_zero': len(sales_values) if sales_values else 0
                } if sales_values else {}
            }
            
        except Exception as e:
            print(f"Error diagnosing data: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}

    def get_training_data_info(self, nodes_path, edges_path, sales_path):
        """Get information about training data files"""
        try:
            info = {}
            
            info['nodes_exists'] = os.path.exists(nodes_path)
            info['edges_exists'] = os.path.exists(edges_path)
            info['sales_exists'] = os.path.exists(sales_path)
            
            if info['nodes_exists']:
                nodes = pd.read_csv(nodes_path)
                info['nodes_count'] = len(nodes)
                info['nodes_columns'] = list(nodes.columns)
                info['nodes_sample'] = nodes.head(5).to_dict('records')
            
            if info['edges_exists']:
                edges = pd.read_csv(edges_path)
                info['edges_count'] = len(edges)
                info['edges_columns'] = list(edges.columns)
                info['edges_sample'] = edges.head(5).to_dict('records')
            
            if info['sales_exists']:
                sales = pd.read_csv(sales_path)
                info['sales_count'] = len(sales)
                info['sales_columns'] = list(sales.columns)
                info['sales_sample'] = sales.head(5).to_dict('records')
                
                # Get product columns (excluding Date)
                product_columns = [col for col in sales.columns if col != 'Date']
                info['product_count'] = len(product_columns)
                info['product_columns'] = product_columns[:20]  # First 20
            
            return info
            
        except Exception as e:
            return {"error": f"Error reading training data: {str(e)}"}

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
                    "node_count": len(model_doc.get('node_list', [])),
                    "architecture": model_doc.get('architecture', {}),
                    "created_at": model_doc.get('created_at', 'unknown')
                }
            else:
                return {"error": "Model not found"}
                
        except Exception as e:
            print(f"Error getting model info: {e}")
            return {"error": str(e)}
