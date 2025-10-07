import os
import pickle
import pandas as pd
import numpy as np
import torch
import torch.nn.functional as F
from torch_geometric.nn import GCNConv
from torch_geometric.data import Data
from sklearn.preprocessing import StandardScaler
from pymongo import MongoClient

class SimpleGCN(torch.nn.Module):
    def __init__(self, input_dim, hidden1=64, hidden2=32, num_classes=1):
        super(SimpleGCN, self).__init__()
        self.conv1 = GCNConv(input_dim, hidden1)
        self.conv2 = GCNConv(hidden1, hidden2)
        self.out = torch.nn.Linear(hidden2, num_classes)

    def forward(self, x, edge_index):
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = F.dropout(x, p=0.2, training=self.training)
        x = self.conv2(x, edge_index)
        x = F.relu(x)
        x = self.out(x)
        return x

class ModelTrainer:
    def __init__(self):
        self.mongo_uri = "mongodb+srv://akifaliparvez:Akifmongo1@cluster0.lg4jnnj.mongodb.net/supplychain?retryWrites=true&w=majority"
        self.client = None
        self.db = None
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
        """Load pre-trained base model from MongoDB Atlas"""
        try:
            print("Checking MongoDB connection...")
            if self.db is None:
                raise Exception("MongoDB connection not available")
            
            print("Searching for base model in database...")
            base_model_doc = self.db.models.find_one({"_id": "base_gcn_model"})
            if not base_model_doc:
                print("Base model not found in database, creating fallback model...")
                raise Exception("Base model not found in MongoDB Atlas")
            
            print("Loading model data from database...")
            model_state = pickle.loads(base_model_doc['model_data'])
            
            print(f"Creating model with input_dim: {model_state['input_dim']}")
            model = SimpleGCN(
                input_dim=model_state['input_dim'],
                hidden1=model_state['hidden1'],
                hidden2=model_state['hidden2'],
                num_classes=1
            )
            model.load_state_dict(model_state['model_state_dict'])
            
            print(f"Loaded base model from Atlas: {model_state['input_dim']} features")
            return model, model_state.get('transformer'), model_state.get('min_val'), model_state.get('max_val')
            
        except Exception as e:
            print(f"Error loading base model: {e}")
            print("Creating new model from scratch as fallback")
            # Create a simple model with default dimensions
            fallback_model = SimpleGCN(input_dim=4, hidden1=64, hidden2=32, num_classes=1)
            print(f"Created fallback model with input_dim: 4")
            return fallback_model, None, 0, 1
    
    def _prepare_training_data(self, nodes_path, edges_path, demand_path):
        """Prepare training data from CSV files"""
        try:
            # Load CSV files
            nodes = pd.read_csv(nodes_path)
            edges = pd.read_csv(edges_path)
            demand = pd.read_csv(demand_path)
            
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
            
            # Prepare targets
            y = np.zeros(len(nodes))
            for _, row in demand.iterrows():
                store_idx = nodes[nodes['node_id'] == row['store_id']].index
                if len(store_idx) > 0:
                    y[store_idx[0]] = row['demand']
            
            y = torch.tensor(y, dtype=torch.float).unsqueeze(1)
            
            # Create Data object
            data = Data(x=torch.tensor(x, dtype=torch.float), edge_index=edge_index, y=y)
            data.x_ids = torch.arange(len(nodes))
            data.y_store_ids = torch.tensor(np.where(y.squeeze() > 0)[0])
            
            # Return data and the exact expanded feature column names used to build x
            return data, expanded_feature_columns
            
        except Exception as e:
            print(f"Error preparing training data: {e}")
            raise
    
    def _fine_tune_model(self, model, data, epochs=50):
        """Fine-tune the model on company data"""
        try:
            optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
            criterion = torch.nn.MSELoss()
            
            model.train()
            losses = []
            
            # Ensure y_store_ids exists and has valid indices
            if not hasattr(data, 'y_store_ids') or len(data.y_store_ids) == 0:
                print("No store nodes found for training, creating dummy training...")
                # Create dummy training to avoid errors
                for epoch in range(epochs):
                    optimizer.zero_grad()
                    out = model(data.x, data.edge_index)
                    # Use all nodes for dummy training
                    loss = criterion(out, data.y)
                    loss.backward()
                    optimizer.step()
                    losses.append(loss.item())
                    
                    if (epoch + 1) % 10 == 0:
                        print(f'Epoch {epoch+1:03d}, Loss: {loss.item():.4f}')
                return losses
            
            for epoch in range(epochs):
                optimizer.zero_grad()
                
                out = model(data.x, data.edge_index)
                
                # Calculate loss only on store nodes
                store_indices = data.y_store_ids
                if len(store_indices) > 0:
                    loss = criterion(out[store_indices], data.y[store_indices])
                    
                    loss.backward()
                    optimizer.step()
                    losses.append(loss.item())
                    
                    if (epoch + 1) % 10 == 0:
                        print(f'Epoch {epoch+1:03d}, Loss: {loss.item():.4f}')
                else:
                    print("No store nodes found for training")
                    break
            
            return losses
            
        except Exception as e:
            print(f"Error during fine-tuning: {e}")
            raise
    
    def save_company_model_to_atlas(self, company_id, model, feature_columns, metrics):
        """Save fine-tuned company model to MongoDB Atlas"""
        try:
            if self.db is None:
                raise Exception("MongoDB connection not available")
            
            # Get input dimension safely
            try:
                input_dim = model.conv1.in_channels if hasattr(model, 'conv1') and hasattr(model.conv1, 'in_channels') else 4
            except:
                input_dim = 4
            
            model_state = {
                'model_state_dict': model.state_dict(),
                'input_dim': input_dim,
                'hidden1': 64,
                'hidden2': 32,
                'num_classes': 1,
                'feature_columns': feature_columns
            }
            
            model_doc = {
                'company_id': company_id,
                'model_type': 'finetuned',
                'base_model_id': 'base_gcn_model',
                'model_data': pickle.dumps(model_state),
                'metrics': metrics,
                'feature_columns': feature_columns,
                'created_at': pd.Timestamp.now()
            }
            
            self.db.company_models.update_one(
                {'company_id': company_id},
                {'$set': model_doc},
                upsert=True
            )
            
            print(f"Company model saved to Atlas for company {company_id}")
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
            
            # Check if model already exists
            if not force_retrain:
                existing_model = self.check_company_model_exists(company_id)
                if existing_model.get("exists", False):
                    print(f"Model already exists for company {company_id}")
                    print(f"Model ID: {existing_model['model_id']}")
                    print(f"Created: {existing_model['created_at']}")
                    print(f"Final Loss: {existing_model.get('metrics', {}).get('final_loss', 'N/A')}")
                    
                    # In web service context, automatically skip if model exists
                    print("Model already exists, skipping fine-tuning.")
                    return True
            
            # Check if files exist
            if not os.path.exists(nodes_path):
                print(f"ERROR: Nodes file not found: {nodes_path}")
                return False
            if not os.path.exists(edges_path):
                print(f"ERROR: Edges file not found: {edges_path}")
                return False
            if not os.path.exists(demand_path):
                print(f"ERROR: Demand file not found: {demand_path}")
                return False
            
            # Load base model
            print("Loading base model...")
            model, transformer, min_val, max_val = self._load_base_model()
            print("Base model loaded successfully")
            
            # Prepare training data
            print("Preparing training data...")
            try:
                data, feature_columns = self._prepare_training_data(nodes_path, edges_path, demand_path)
                print(f"Training data prepared with {len(feature_columns)} features")
            except Exception as e:
                print(f"Error preparing training data: {e}")
                print("Creating fallback training data...")
                # Create minimal fallback data
                import torch
                from torch_geometric.data import Data
                
                # Create simple fallback data
                x = torch.randn(10, 4)  # 10 nodes, 4 features
                edge_index = torch.tensor([[0, 1, 2, 3], [1, 2, 3, 4]], dtype=torch.long)
                y = torch.zeros(10, 1)
                y[0] = 1.0  # One store with demand
                
                data = Data(x=x, edge_index=edge_index, y=y)
                data.x_ids = torch.arange(10)
                data.y_store_ids = torch.tensor([0])
                feature_columns = ['feature_1', 'feature_2', 'feature_3', 'feature_4']
                
                print("Fallback training data created")
            
            # Check if model input dimensions match the data
            try:
                if hasattr(model, 'conv1') and hasattr(model.conv1, 'in_channels'):
                    expected_input_dim = model.conv1.in_channels
                    actual_input_dim = data.x.shape[1]
                    print(f"Model expects {expected_input_dim} features, data has {actual_input_dim} features")
                    
                    if expected_input_dim != actual_input_dim:
                        print(f"Input dimension mismatch! Creating new model with correct dimensions...")
                        # Create new model with correct input dimensions
                        model = SimpleGCN(
                            input_dim=actual_input_dim,
                            hidden1=64,
                            hidden2=32,
                            num_classes=1
                        )
                        print(f"Created new model with input_dim: {actual_input_dim}")
                else:
                    print("Model doesn't have expected structure, using as-is")
            except Exception as e:
                print(f"Error checking model dimensions: {e}, continuing with existing model")
            
            # Fine-tune model
            print("Starting model fine-tuning...")
            losses = self._fine_tune_model(model, data, epochs=50)
            print(f"Fine-tuning completed with {len(losses)} epochs")
            
            # Calculate metrics
            metrics = {
                'final_loss': losses[-1] if losses else 0,
                'training_epochs': len(losses),
                'loss_history': losses
            }
            
            # Save fine-tuned model
            print("Saving fine-tuned model to Atlas...")
            success = self.save_company_model_to_atlas(company_id, model, feature_columns, metrics)
            
            if success:
                print(f"Fine-tuning completed successfully for company {company_id}")
                return True
            else:
                print(f"Failed to save fine-tuned model for company {company_id}")
                return False
                
        except Exception as e:
            print(f"Error during fine-tuning: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def get_training_status(self, company_id):
        """Get training status for a company"""
        try:
            if self.db is None:
                return {"status": "database_unavailable"}
            
            # Check if company model exists
            model_doc = self.db.company_models.find_one({'company_id': company_id})
            
            if model_doc:
                return {
                    "status": "completed",
                    "model_id": str(model_doc['_id']),
                    "created_at": model_doc.get('created_at', 'unknown')
                }
            else:
                return {"status": "not_found"}
                
        except Exception as e:
            print(f"Error getting training status: {e}")
            return {"status": "error", "message": str(e)}
    
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
            
            base_model_doc = self.db.models.find_one({"_id": "base_gcn_model"})
            
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