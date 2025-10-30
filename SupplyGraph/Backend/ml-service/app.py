from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import pandas as pd
import numpy as np
from datetime import datetime
from training.trainer import ModelTrainer
from prediction.predictor import DemandPredictor

app = Flask(__name__)
CORS(app)

# Initialize ML components
trainer = ModelTrainer()
predictor = DemandPredictor()

# Simple data loader class
class DataLoader:
    def load_company_data(self, company_id):
        """Load company data from uploaded files"""
        try:
            # Look for company data in uploads directory
            backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            company_dir = os.path.join(backend_dir, "uploads", company_id)
            
            if not os.path.exists(company_dir):
                return None
            
            # Try to load the processed CSV files
            nodes_path = os.path.join(company_dir, "nodes.csv")
            edges_path = os.path.join(company_dir, "edges.csv")
            demand_path = os.path.join(company_dir, "demand.csv")
            
            data = {}
            
            if os.path.exists(demand_path):
                data['demand'] = pd.read_csv(demand_path)
            
            if os.path.exists(nodes_path):
                data['nodes'] = pd.read_csv(nodes_path)
                
            if os.path.exists(edges_path):
                data['edges'] = pd.read_csv(edges_path)
            
            return data if data else None
            
        except Exception as e:
            print(f"Error loading company data: {e}")
            return None

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

@app.route('/training-status/<company_id>', methods=['GET'])
def training_status(company_id):
    try:
        status = trainer.get_training_status(company_id)
        return jsonify(status)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/model-info/<company_id>', methods=['GET'])
def model_info(company_id):
    try:
        info = trainer.get_model_info(company_id)
        return jsonify(info)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/validate-data/<company_id>', methods=['GET'])
def validate_data(company_id):
    try:
        # Basic validation: base model exists and company model presence
        base = trainer.check_base_model_exists()
        company = trainer.check_company_model_exists(company_id)
        return jsonify({
            "base_model": base,
            "company_model": company
        })
    except Exception as e:
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

@app.route('/diagnose-data', methods=['POST'])
def diagnose_training_data():
    try:
        data = request.json
        nodes_path = data.get('nodes')
        edges_path = data.get('edges')
        demand_path = data.get('demand')
        
        if not nodes_path or not edges_path or not demand_path:
            return jsonify({"error": "nodes, edges, and demand paths are required"}), 400
        
        # Fix file paths - look relative to backend directory
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        nodes_full_path = os.path.join(backend_dir, nodes_path)
        edges_full_path = os.path.join(backend_dir, edges_path)
        demand_full_path = os.path.join(backend_dir, demand_path)
        
        diagnosis = trainer.diagnose_training_data(nodes_full_path, edges_full_path, demand_full_path)
        
        return jsonify({
            "success": True,
            "diagnosis": diagnosis,
            "file_paths": {
                "nodes": nodes_full_path,
                "edges": edges_full_path,
                "demand": demand_full_path
            }
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/historical-data/<company_id>', methods=['GET'])
def get_historical_data(company_id):
    try:
        # Load company data
        data_loader = DataLoader()
        company_data = data_loader.load_company_data(company_id)
        
        if not company_data:
            return jsonify({"error": "Company data not found"}), 404
        
        demand_df = company_data['demand']
        
        # Convert sales data to historical format
        historical_data = []
        try:
            for _, row in demand_df.iterrows():
                # Extract time series sales data (t1, t2, t3, etc.)
                time_columns = [col for col in row.index if col.startswith('t') and col[1:].isdigit()]
                
                if time_columns:
                    # Create multiple records for time series data
                    for i, col in enumerate(time_columns):
                        try:
                            if not pd.isna(row[col]) and row[col] != 0:
                                historical_data.append({
                                    'date': f'2024-{i+1:02d}-01',  # Generate dates for time periods
                                    'sales': float(row[col]),
                                    'product': row.get('node_id', 'Unknown'),
                                    'store': row.get('node_id', 'Unknown'),
                                    'period': col
                                })
                        except (ValueError, TypeError):
                            continue
                else:
                    # Fallback for old format
                    try:
                        historical_data.append({
                            'date': row.get('date', row.get('timestamp', '2024-01-01')),
                            'sales': float(row.get('demand', row.get('value', 0))),
                            'product': row.get('product', row.get('node_id', 'Unknown')),
                            'store': row.get('store', row.get('node_id', 'Unknown'))
                        })
                    except (ValueError, TypeError):
                        continue
        except Exception as e:
            print(f"Error processing historical data: {e}")
            # Return empty data if processing fails
            historical_data = []
        
        return jsonify({
            "company_id": company_id,
            "historical_data": historical_data,
            "total_records": len(historical_data)
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/inventory/trending/<company_id>', methods=['GET'])
def get_trending_inventory(company_id):
    try:
        time_range = request.args.get('timeRange', '30d')
        print(f"Getting trending inventory for company {company_id}, time range: {time_range}")
        
        # Load company data
        data_loader = DataLoader()
        company_data = data_loader.load_company_data(company_id)
        
        if not company_data or 'demand' not in company_data:
            print(f"No company data found for {company_id}, returning mock data")
            # Return mock data instead of error
            return jsonify({
                "company_id": company_id,
                "time_range": time_range,
                "trending_items": get_mock_trending_data(),
                "total_analyzed": 10,
                "note": "Using mock data - no company data found"
            })
        
        demand_df = company_data['demand']
        print(f"Loaded sales data with {len(demand_df)} records")
        
        # Get unique products from sales data (now using node_id)
        if 'node_id' in demand_df.columns:
            products = demand_df['node_id'].unique()
        elif 'product' in demand_df.columns:
            products = demand_df['product'].unique()
        elif 'store_id' in demand_df.columns:
            products = demand_df['store_id'].unique()
        else:
            # Fallback: use first few rows as products
            products = demand_df.index[:10].tolist()
        
        print(f"Found {len(products)} products: {products[:5]}...")
        
        trending_items = []
        
        # Limit to first 10 products for performance
        for product in products[:10]:
            try:
                print(f"Processing product: {product}")
                
                # Get sales data for this product
                if 'node_id' in demand_df.columns:
                    product_data = demand_df[demand_df['node_id'] == product]
                elif 'product' in demand_df.columns:
                    product_data = demand_df[demand_df['product'] == product]
                elif 'store_id' in demand_df.columns:
                    product_data = demand_df[demand_df['store_id'] == product]
                else:
                    # Use the row directly
                    product_data = demand_df.iloc[[product]] if isinstance(product, int) else pd.DataFrame()
                
                if len(product_data) == 0:
                    continue
                
                # Extract time series sales data (t1, t2, t3, etc.)
                time_columns = [col for col in product_data.columns if col.startswith('t') and col[1:].isdigit()]
                
                if time_columns:
                    # Calculate historical average from time series
                    sales_values = []
                    for col in time_columns:
                        try:
                            val = product_data[col].iloc[0]
                            if not pd.isna(val) and val != 0:
                                sales_values.append(float(val))
                        except (IndexError, ValueError, TypeError):
                            continue
                    
                    historical_avg = sum(sales_values) / len(sales_values) if sales_values else 0
                else:
                    # Fallback for old format
                    try:
                        historical_avg = float(product_data['demand'].mean()) if 'demand' in product_data.columns else 0
                    except (KeyError, TypeError):
                        historical_avg = 0
                
                # Get prediction for this product
                try:
                    prediction_result = predictor.predict(company_id, [{"node_type": "store", "company": company_id, "product": str(product)}])
                    predicted_demand = prediction_result['prediction'][0] if prediction_result['prediction'] else historical_avg
                except Exception as pred_error:
                    print(f"Prediction failed for {product}: {pred_error}")
                    # Use a simple trend estimation if prediction fails
                    if len(product_data) > 1:
                        recent_avg = float(product_data.tail(3)['demand'].mean())
                        predicted_demand = recent_avg * 1.1  # Simple 10% growth assumption
                    else:
                        predicted_demand = historical_avg
                
                # Calculate trend metrics
                if historical_avg > 0:
                    growth_rate = ((predicted_demand - historical_avg) / historical_avg) * 100
                else:
                    growth_rate = 0
                
                trend_direction = "up" if growth_rate > 5 else "down" if growth_rate < -5 else "stable"
                
                # Risk assessment based on volatility
                try:
                    if time_columns and sales_values and len(sales_values) > 1:
                        volatility = float(np.std(sales_values))
                        if historical_avg > 0:
                            volatility_ratio = volatility / historical_avg
                            risk_level = "high" if volatility_ratio > 0.5 else "medium" if volatility_ratio > 0.2 else "low"
                        else:
                            risk_level = "low"
                    else:
                        volatility = 0
                        risk_level = "low"
                except (TypeError, ValueError):
                    volatility = 0
                    risk_level = "low"
                
                trending_items.append({
                    'product': str(product),
                    'current_demand': round(historical_avg, 2),  # Keep field name for compatibility
                    'predicted_demand': round(predicted_demand, 2),  # Keep field name for compatibility
                    'current_sales': round(historical_avg, 2),
                    'predicted_sales': round(predicted_demand, 2),
                    'growth_rate': round(growth_rate, 2),
                    'trend_direction': trend_direction,
                    'risk_level': risk_level,
                    'volatility': round(volatility, 2),
                    'recommendation': get_recommendation(growth_rate, risk_level)
                })
                
                print(f"Added trending item: {product} - Growth: {growth_rate:.2f}%")
                
            except Exception as e:
                print(f"Error processing product {product}: {e}")
                continue
        
        # Sort by absolute growth rate and take top 10
        trending_items.sort(key=lambda x: abs(x['growth_rate']), reverse=True)
        top_10 = trending_items[:10]
        
        print(f"Returning {len(top_10)} trending items")
        
        return jsonify({
            "company_id": company_id,
            "time_range": time_range,
            "trending_items": top_10,
            "total_analyzed": len(trending_items)
        })
    
    except Exception as e:
        print(f"Error in get_trending_inventory: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/inventory/analytics/<company_id>', methods=['GET'])
def get_inventory_analytics(company_id):
    try:
        print(f"Getting inventory analytics for company {company_id}")
        
        # Load company data
        data_loader = DataLoader()
        company_data = data_loader.load_company_data(company_id)
        
        if not company_data or 'demand' not in company_data:
            print(f"No company data found for {company_id}, returning mock data")
            # Return mock data instead of error
            return jsonify({
                "company_id": company_id,
                "summary": {
                    "total_products": 25,
                    "total_demand": 15420.50,
                    "average_demand": 616.82,
                    "total_sales": 15420.50,
                    "average_sales": 616.82,
                    "trending_up": 8,
                    "trending_down": 5,
                    "stable": 12
                },
                "note": "Using mock data - no company data found"
            })
        
        demand_df = company_data['demand']
        
        # Calculate summary statistics for sales data
        if 'node_id' in demand_df.columns:
            total_products = len(demand_df['node_id'].unique())
        elif 'product' in demand_df.columns:
            total_products = len(demand_df['product'].unique())
        elif 'store_id' in demand_df.columns:
            total_products = len(demand_df['store_id'].unique())
        else:
            total_products = len(demand_df)
        
        # Calculate total sales from time series columns
        time_columns = [col for col in demand_df.columns if col.startswith('t') and col[1:].isdigit()]
        if time_columns:
            total_sales = 0
            sales_count = 0
            try:
                for col in time_columns:
                    col_sum = demand_df[col].sum()
                    if not pd.isna(col_sum):
                        total_sales += float(col_sum)
                        sales_count += len(demand_df[col].dropna())
                
                total_demand = total_sales
                avg_demand = total_sales / sales_count if sales_count > 0 else 0
            except (TypeError, ValueError, KeyError):
                total_demand = 0
                avg_demand = 0
        else:
            # Fallback for old format
            try:
                total_demand = float(demand_df['demand'].sum()) if 'demand' in demand_df.columns else 0
                avg_demand = float(demand_df['demand'].mean()) if 'demand' in demand_df.columns else 0
            except (KeyError, TypeError):
                total_demand = 0
                avg_demand = 0
        
        # Simple trending counts (mock data for now)
        trending_up = max(1, total_products // 4)
        trending_down = max(1, total_products // 5)
        stable = total_products - trending_up - trending_down
        
        return jsonify({
            "company_id": company_id,
            "summary": {
                "total_products": total_products,
                "total_demand": round(total_demand, 2),  # Keep for compatibility
                "average_demand": round(avg_demand, 2),  # Keep for compatibility
                "total_sales": round(total_demand, 2),
                "average_sales": round(avg_demand, 2),
                "trending_up": trending_up,
                "trending_down": trending_down,
                "stable": max(0, stable)
            }
        })
    
    except Exception as e:
        print(f"Error in get_inventory_analytics: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

def get_recommendation(growth_rate, risk_level):
    """Generate inventory recommendation based on growth rate and risk"""
    if growth_rate > 20:
        return "Stock Up - High Growth Expected"
    elif growth_rate > 5:
        return "Monitor - Moderate Growth"
    elif growth_rate < -20:
        return "Reduce Stock - Declining Demand"
    elif growth_rate < -5:
        return "Caution - Demand Decreasing"
    else:
        if risk_level == "high":
            return "Monitor Closely - High Volatility"
        else:
            return "Maintain - Stable Demand"

def get_mock_trending_data():
    """Generate mock trending data for testing"""
    return [
        {
            'product': 'iPhone 14 Pro',
            'current_demand': 1250.0,
            'predicted_demand': 1380.0,
            'current_sales': 1250.0,
            'predicted_sales': 1380.0,
            'growth_rate': 10.4,
            'trend_direction': 'up',
            'risk_level': 'medium',
            'volatility': 125.3,
            'recommendation': 'Monitor - Moderate Growth'
        },
        {
            'product': 'Galaxy S23',
            'current_demand': 980.0,
            'predicted_demand': 1050.0,
            'current_sales': 980.0,
            'predicted_sales': 1050.0,
            'growth_rate': 7.1,
            'trend_direction': 'up',
            'risk_level': 'low',
            'volatility': 89.2,
            'recommendation': 'Monitor - Moderate Growth'
        },
        {
            'product': 'Air Jordan 1',
            'current_demand': 850.0,
            'predicted_demand': 920.0,
            'current_sales': 850.0,
            'predicted_sales': 920.0,
            'growth_rate': 8.2,
            'trend_direction': 'up',
            'risk_level': 'medium',
            'volatility': 102.5,
            'recommendation': 'Monitor - Moderate Growth'
        },
        {
            'product': 'PlayStation 5',
            'current_demand': 450.0,
            'predicted_demand': 520.0,
            'current_sales': 450.0,
            'predicted_sales': 520.0,
            'growth_rate': 15.6,
            'trend_direction': 'up',
            'risk_level': 'high',
            'volatility': 78.9,
            'recommendation': 'Monitor Closely - High Volatility'
        },
        {
            'product': 'MacBook Pro',
            'current_demand': 789.0,
            'predicted_demand': 750.0,
            'current_sales': 789.0,
            'predicted_sales': 750.0,
            'growth_rate': -4.9,
            'trend_direction': 'stable',
            'risk_level': 'low',
            'volatility': 45.2,
            'recommendation': 'Maintain - Stable Demand'
        }
    ]



if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True) 