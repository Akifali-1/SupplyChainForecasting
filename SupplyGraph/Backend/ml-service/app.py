from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
from datetime import datetime
from training.trainer import ModelTrainer
from prediction.predictor import DemandPredictor

app = Flask(__name__)
CORS(app)

# Initialize ML components
trainer = ModelTrainer()
predictor = DemandPredictor()

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "ML Service", "timestamp": datetime.now().isoformat()})

@app.route('/status', methods=['GET'])
def system_status():
    try:
        # Check base model
        base_model_status = trainer.check_base_model_exists()
        
        # Check database connection
        db_status = "connected" if trainer.db is not None else "disconnected"
        
        return jsonify({
            "status": "healthy",
            "service": "ML Service",
            "timestamp": datetime.now().isoformat(),
            "database": db_status,
            "base_model": base_model_status
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "service": "ML Service",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }), 500

@app.route('/fine-tune', methods=['POST'])
def start_fine_tuning():
    try:
        data = request.json
        company_id = data.get('company_id')
        nodes_path = data.get('nodes')
        edges_path = data.get('edges')
        demand_path = data.get('demand')
        force_retrain = data.get('force_retrain', False)
        
        print(f"Starting fine-tuning for company {company_id}")
        print(f"Nodes path: {nodes_path}")
        print(f"Edges path: {edges_path}")
        print(f"Demand path: {demand_path}")
        print(f"Force retrain: {force_retrain}")
        
        if not company_id:
            return jsonify({"error": "company_id is required"}), 400
        
        if not nodes_path or not edges_path or not demand_path:
            return jsonify({"error": "nodes, edges, and demand paths are required"}), 400
        
        # Fix file paths - look relative to backend directory
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        nodes_full_path = os.path.join(backend_dir, nodes_path)
        edges_full_path = os.path.join(backend_dir, edges_path)
        demand_full_path = os.path.join(backend_dir, demand_path)
        
        print(f"Full paths:")
        print(f"  Nodes: {nodes_full_path}")
        print(f"  Edges: {edges_full_path}")
        print(f"  Demand: {demand_full_path}")
        
        # Start fine-tuning process with full paths
        result = trainer.fine_tune_company_model(company_id, nodes_full_path, edges_full_path, demand_full_path, force_retrain)
        
        if result:
            return jsonify({
                "success": True,
                "message": "Fine-tuning completed",
                "company_id": company_id,
                "model_path": f"atlas_model_{company_id}"
            })
        else:
            return jsonify({"error": "Fine-tuning failed"}), 500
    
    except Exception as e:
        print(f"Error in fine-tuning: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/predict', methods=['POST'])
def generate_prediction():
    try:
        data = request.json
        company_id = data.get('company_id')
        input_data = data.get('input_data')
        
        if not company_id or not input_data:
            return jsonify({"error": "company_id and input_data are required"}), 400
        
        # Generate prediction
        prediction = predictor.predict(company_id, input_data)
        return jsonify({"prediction": prediction})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True) 