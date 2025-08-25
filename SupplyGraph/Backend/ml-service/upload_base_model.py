# SupplyGraph/Backend/ml-service/upload_base_model.py
import pickle
import json
import torch
import os
import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

def upload_base_model():
    """Upload the locally saved base model to MongoDB Atlas"""
    
    try:
        # Load the model files
        model_path = "models/base_gcn.pth"
        encoder_path = "models/feature_encoder.pkl"
        meta_path = "models/meta.json"
        
        if not all(os.path.exists(p) for p in [model_path, encoder_path, meta_path]):
            print("❌ Model files not found. Make sure they're in the models/ folder")
            return False
        
        # Load model state
        model_state = torch.load(model_path, map_location='cpu')
        
        try:
            with open(encoder_path, 'rb') as f:
                encoder = pickle.load(f)
        except Exception as e:
            print(f"⚠️  Warning: Could not load encoder due to version mismatch: {e}")
            print("⚠️  Creating a new encoder for compatibility")
            encoder = None
        
        with open(meta_path, 'r') as f:
            meta = json.load(f)
        
        print("✅ Model files loaded successfully")
        
        # Connect to MongoDB Atlas
        mongo_uri = "mongodb+srv://akifaliparvez:Akifmongo1@cluster0.lg4jnnj.mongodb.net/supplychain?retryWrites=true&w=majority"
        
        client = MongoClient(mongo_uri, 
                           tls=True,
                           tlsAllowInvalidCertificates=True,
                           serverSelectionTimeoutMS=30000)
        db = client.supplychain
        
        # Test connection
        client.admin.command('ping')
        print("✅ Connected to MongoDB Atlas!")
        
        # Prepare model document
        base_model_doc = {
            "_id": "base_gcn_model",
            "model_type": "base",
            "model_data": pickle.dumps({
                'model_state_dict': model_state,
                'input_dim': meta['input_dim'],
                'hidden1': 64,
                'hidden2': 32,
                'num_classes': 1,
                'feature_columns': meta.get('categorical_columns', []) + meta.get('numerical_columns', []),
                'transformer': encoder,
                'min_val': meta.get('min_val', 0),
                'max_val': meta.get('max_val', 1),
                'dataset_stats': {
                    'categorical_columns': meta.get('categorical_columns', []),
                    'numerical_columns': meta.get('numerical_columns', [])
                }
            }),
            "metadata": {
                "input_dim": meta['input_dim'],
                "hidden1": 64,
                "hidden2": 32,
                "training_epochs": 300,
                "created_at": pd.Timestamp.now()
            }
        }
        
        # Upload to Atlas
        result = db.models.update_one(
            {"_id": "base_gcn_model"},
            {"$set": base_model_doc},
            upsert=True
        )
        
        if result.upserted_id:
            print("✅ Base model uploaded to MongoDB Atlas!")
        else:
            print("✅ Base model updated in MongoDB Atlas!")
        
        client.close()
        return True
        
    except Exception as e:
        print(f"❌ Error uploading model: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Starting base model upload to MongoDB Atlas...")
    success = upload_base_model()
    if success:
        print("🎉 Upload completed successfully!")
    else:
        print("💥 Upload failed!")