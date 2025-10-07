import os
import pickle
import pandas as pd
import numpy as np
import torch
from pymongo import MongoClient

class DemandPredictor:
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
            print("Connected to MongoDB Atlas for prediction")
        except Exception as e:
            print(f"Failed to connect to MongoDB: {e}")
            self.client = None
            self.db = None
    
    def _load_company_model(self, company_id):
        """Load fine-tuned company model from MongoDB Atlas"""
        try:
            if self.db is None:
                raise Exception("MongoDB connection not available")
            
            model_doc = self.db.company_models.find_one({'company_id': company_id})
            if not model_doc:
                raise Exception(f"Company model not found for company {company_id}")
            
            model_state = pickle.loads(model_doc['model_data'])
            
            from training.trainer import SimpleGCN
            model = SimpleGCN(
                input_dim=model_state['input_dim'],
                hidden1=model_state['hidden1'],
                hidden2=model_state['hidden2'],
                num_classes=1
            )
            model.load_state_dict(model_state['model_state_dict'])
            model.eval()
            
            return model, model_state.get('feature_columns', [])
            
        except Exception as e:
            print(f"Error loading company model: {e}")
            raise
    
    def _prepare_input_data(self, input_data, feature_columns):
        """Prepare input data for prediction using the expanded feature schema saved during training.
        Categorical inputs are one-hot encoded with the same prefixes as training (e.g., node_type_*, product_*, company_*).
        Unknown categories are encoded as all-zeros for their group.
        """
        try:
            # Convert input to DataFrame
            if isinstance(input_data, dict):
                df = pd.DataFrame([input_data])
            else:
                df = pd.DataFrame(input_data)
            
            # Build an output dataframe with the exact training-time expanded columns, in-order
            out = pd.DataFrame(index=df.index)
            for col in feature_columns:
                # Handle one-hot columns such as node_type_store, product_itemA, company_123
                if '_' in col and any(col.startswith(prefix) for prefix in ['node_type_', 'product_', 'company_']):
                    prefix = col.split('_')[0]
                    raw_col = prefix  # expected raw key in request
                    expected_value = col[len(prefix) + 1:]
                    # Compare case-insensitively and stringify
                    val_series = df.get(raw_col, '').astype(str).str.lower()
                    out[col] = (val_series == str(expected_value).lower()).astype(float)
                else:
                    # Numeric feature carried over by name if present; else zero
                    if col in df.columns:
                        out[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)
                    else:
                        out[col] = 0.0

            # Convert to tensor in the exact column order
            x = torch.tensor(out[feature_columns].values, dtype=torch.float) if len(feature_columns) > 0 else torch.zeros((len(df), 1), dtype=torch.float)
            
            return x
            
        except Exception as e:
            print(f"Error preparing input data: {e}")
            raise
    
    def _build_safe_edge_index(self, num_nodes: int) -> torch.Tensor:
        """Create a self-loop edge_index for the given number of nodes.
        This avoids out-of-bounds errors when predicting with small batches.
        """
        if num_nodes <= 0:
            return torch.empty((2, 0), dtype=torch.long)
        indices = torch.arange(num_nodes, dtype=torch.long)
        edge_index = torch.stack([indices, indices], dim=0)
        return edge_index

    def _align_features_to_model_dim(self, x: torch.Tensor, expected_dim: int) -> torch.Tensor:
        """Pad or trim feature columns so x.shape[1] == expected_dim."""
        current_dim = x.shape[1] if x.ndim == 2 else 1
        if current_dim == expected_dim:
            return x
        if current_dim < expected_dim:
            pad_cols = expected_dim - current_dim
            pad = torch.zeros((x.shape[0], pad_cols), dtype=x.dtype)
            return torch.cat([x, pad], dim=1)
        return x[:, :expected_dim]
    
    def predict(self, company_id, input_data):
        """Generate demand prediction for a company"""
        try:
            # Load company model
            model, feature_columns = self._load_company_model(company_id)
            
            # Prepare input data
            x = self._prepare_input_data(input_data, feature_columns)
            
            # Align features to model expected input
            expected_input_dim = model.conv1.in_channels if hasattr(model, 'conv1') else x.shape[1]
            x = self._align_features_to_model_dim(x, expected_input_dim)
            
            # Build safe edge_index with self-loops for the given batch size
            edge_index = self._build_safe_edge_index(x.shape[0])
            
            # Make prediction
            with torch.no_grad():
                prediction = model(x, edge_index)
            
            if prediction.dim() == 0:
                prediction = prediction.unsqueeze(0)
            prediction_list = prediction.squeeze(-1).tolist()
            
            return {
                'company_id': company_id,
                'prediction': prediction_list,
                'feature_columns_used': feature_columns,
                'expected_input_dim': int(expected_input_dim),
                'actual_input_dim': int(x.shape[1]),
                'timestamp': pd.Timestamp.now().isoformat()
            }
            
        except Exception as e:
            print(f"Error generating prediction: {e}")
            raise