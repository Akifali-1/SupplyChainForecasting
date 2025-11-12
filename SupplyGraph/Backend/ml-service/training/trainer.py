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
        """Prepare training data from new CSV format"""
        try:
            print("Loading CSV files...")
            nodes_df = pd.read_csv(nodes_path)
            edges_df = pd.read_csv(edges_path)
            sales_df = pd.read_csv(sales_path)
            
            print(f"Loaded: {len(nodes_df)} nodes, {len(edges_df)} edges, {len(sales_df)} sales records")
            print(f"Nodes columns: {list(nodes_df.columns)}")
            print(f"Edges columns: {list(edges_df.columns)}")
            print(f"Sales columns: {list(sales_df.columns)}")
            
            # Validate data
            print("Validating data consistency...")
            validation_errors = self._validate_csv_data(nodes_df, edges_df, sales_df)
            if validation_errors:
                error_msg = "Data validation failed:\n" + "\n".join(validation_errors)
                print(f"VALIDATION ERRORS:\n{error_msg}")
                raise ValueError(error_msg)
            
            # Create node mapping
            node_list = nodes_df['Node'].tolist()
            node_to_idx = {node: idx for idx, node in enumerate(node_list)}
            
            print(f"Created node mapping with {len(node_list)} nodes")
            print(f"First 10 nodes: {node_list[:10]}")
            
            # Prepare node features (Plant column if available)
            if 'Plant' in nodes_df.columns:
                plant_dummies = pd.get_dummies(nodes_df['Plant'], prefix='Plant')
                node_features = plant_dummies.values
                feature_columns = list(plant_dummies.columns)
            else:
                node_features = np.ones((len(nodes_df), 1))
                feature_columns = ['default_feature']
            
            print(f"Node features shape: {node_features.shape}")
            
            # Prepare edges
            edge_list = []
            for _, row in edges_df.iterrows():
                node1 = row['node1']
                node2 = row['node2']
                
                # Skip empty edges
                if pd.isna(node1) or pd.isna(node2) or str(node1).strip() == '' or str(node2).strip() == '':
                    continue
                
                if node1 in node_to_idx and node2 in node_to_idx:
                    edge_list.append([node_to_idx[node1], node_to_idx[node2]])
            
            if not edge_list:
                print("WARNING: No valid edges found, creating minimal edge structure")
                edge_list = [[0, 1], [1, 0]] if len(node_list) > 1 else [[0, 0]]
            
            edge_index = torch.tensor(edge_list, dtype=torch.long).t().contiguous()
            print(f"Created {len(edge_list)} edges")
            
            # Prepare time series data from sales
            product_columns = [col for col in sales_df.columns if col != 'Date']
            print(f"Found {len(product_columns)} product columns: {product_columns[:10]}")
            
            # Sort sales by date
            sales_df['Date'] = pd.to_datetime(sales_df['Date'])
            sales_df = sales_df.sort_values('Date')
            
            # Determine max timesteps (limit to 20 for memory efficiency)
            max_timesteps = min(len(sales_df), 20)
            print(f"Using max_timesteps: {max_timesteps}")
            
            # Create time series data (num_nodes, max_timesteps, 1)
            time_series_x = np.zeros((len(node_list), max_timesteps, 1))
            
            # Fill in time series for each product (node)
            for product in product_columns:
                if product in node_to_idx:
                    node_idx = node_to_idx[product]
                    
                    # Get sales values for this product
                    sales_values = sales_df[product].values[-max_timesteps:]
                    
                    # Left-pad if shorter than max_timesteps
                    if len(sales_values) < max_timesteps:
                        sales_values = np.pad(sales_values, (max_timesteps - len(sales_values), 0), mode='constant')
                    
                    time_series_x[node_idx, :, 0] = sales_values
            
            print(f"Time series data shape: {time_series_x.shape}")
            print(f"Time series stats: min={time_series_x.min():.2f}, max={time_series_x.max():.2f}, mean={time_series_x.mean():.2f}")
            
            # Create targets (average sales for each product)
            y = np.zeros(len(node_list))
            products_with_sales = 0
            
            for product in product_columns:
                if product in node_to_idx:
                    node_idx = node_to_idx[product]
                    sales_values = sales_df[product].values
                    
                    # Calculate average sales
                    non_zero_sales = sales_values[sales_values > 0]
                    if len(non_zero_sales) > 0:
                        y[node_idx] = non_zero_sales.mean()
                        products_with_sales += 1
            
            print(f"Products with sales data: {products_with_sales}")
            print(f"Target stats: min={y.min():.2f}, max={y.max():.2f}, mean={y.mean():.2f}")
            
            # Convert to PyTorch tensors
            x_tensor = torch.tensor(time_series_x, dtype=torch.float)
            y_tensor = torch.tensor(y, dtype=torch.float).unsqueeze(1)
            
            # Create Data object
            data = Data(x=x_tensor, edge_index=edge_index, y=y_tensor)
            data.max_timesteps = max_timesteps
            data.x_ids = torch.arange(len(node_list))
            
            # Identify nodes with non-zero targets
            store_indices = np.where(y > 0)[0]
            data.y_store_ids = torch.tensor(store_indices)
            
            print(f"Store node indices: {len(store_indices)} nodes with non-zero sales")
            
            # Prepare scalers for each node
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
            
            # Store for later use
            self._training_node_to_idx = node_to_idx
            self._training_scalers = {k: type('obj', (), {'mean_': np.array(v['mean_']), 'scale_': np.array(v['scale_'])}) 
                                     for k, v in training_scalers.items()}
            
            return data, feature_columns
            
        except Exception as e:
            print(f"Error preparing training data: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    def _fine_tune_model(self, model, data, epochs=50, company_id=None):
        """Fine-tune the model on company data"""
        try:
            optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
            criterion = torch.nn.MSELoss()
            
            model.train()
            losses = []
            
            if not hasattr(data, 'y_store_ids') or len(data.y_store_ids) == 0:
                print("❌ CRITICAL: No store nodes found for training!")
                raise ValueError("No store nodes found for training")
            
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
                    progress = 50 + int((epoch + 1) / epochs * 40)
                    self._update_training_status(company_id, "training", progress, 
                                               f"Training epoch {epoch+1}/{epochs}, Loss: {loss.item():.4f}")
                
                # Logging
                if (epoch + 1) % 10 == 0:
                    print(f'Epoch {epoch+1:03d}, Loss: {loss.item():.4f}')
                    print(f'  Predictions: {store_predictions.squeeze().detach().numpy()[:5]}...')
                    print(f'  Targets:     {store_targets.squeeze().numpy()[:5]}...')
                
                # Early stopping
                if loss.item() < 1e-6:
                    print(f"Early stopping at epoch {epoch+1}")
                    break
            
            return losses
            
        except Exception as e:
            print(f"Error during fine-tuning: {e}")
            raise
    
    def save_company_model_to_atlas(self, company_id, model, feature_columns, metrics, scalers=None, node_to_idx=None, last_x=None):
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
                    'max_timesteps': getattr(model, 'max_timesteps', 5),
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
            print(f"Starting fine-tuning for company {company_id}")
            print(f"Nodes: {nodes_path}")
            print(f"Edges: {edges_path}")
            print(f"Sales: {sales_path}")
            
            self._update_training_status(company_id, "starting", 0, "Initializing...")
            
            # Check existing model
            if not force_retrain:
                existing_model = self.check_company_model_exists(company_id)
                if existing_model.get("exists", False):
                    print(f"Model already exists for company {company_id}")
                    self._update_training_status(company_id, "completed", 100, "Model already trained")
                    return True
            
            # Validate files
            self._update_training_status(company_id, "validating", 10, "Checking files...")
            missing_files = []
            if not os.path.exists(nodes_path):
                missing_files.append(f"Nodes: {nodes_path}")
            if not os.path.exists(edges_path):
                missing_files.append(f"Edges: {edges_path}")
            if not os.path.exists(sales_path):
                missing_files.append(f"Sales: {sales_path}")
            
            if missing_files:
                error_msg = "Missing files:\n" + "\n".join(missing_files)
                self._update_training_status(company_id, "failed", 0, "File validation failed", error_msg)
                return False
            
            # Load base model
            self._update_training_status(company_id, "loading_model", 20, "Loading base model...")
            model, node_list, scalers, node_to_idx = self._load_base_model()
            
            # Prepare data
            self._update_training_status(company_id, "preparing_data", 30, "Preparing training data...")
            data, feature_columns = self._prepare_training_data(nodes_path, edges_path, sales_path)
            
            # Fine-tune
            self._update_training_status(company_id, "training", 50, "Training model...")
            losses = self._fine_tune_model(model, data, epochs=50, company_id=company_id)
            
            # Save model
            self._update_training_status(company_id, "saving", 90, "Saving model...")
            metrics = {
                'final_loss': losses[-1] if losses else 0,
                'training_epochs': len(losses),
                'loss_history': losses
            }
            
            scalers = getattr(self, '_training_scalers', None)
            node_to_idx = getattr(self, '_training_node_to_idx', None)
            
            success = self.save_company_model_to_atlas(company_id, model, feature_columns, metrics, scalers, node_to_idx)
            
            if success:
                self._update_training_status(company_id, "completed", 100, 
                                           f"Training completed! Final loss: {losses[-1]:.4f}")
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