import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import pandas as pd
import numpy as np
from datetime import datetime
from dotenv import load_dotenv
from training.trainer import ModelTrainer
from prediction.predictor import DemandPredictor

load_dotenv()

app = Flask(__name__)
CORS(app)
DEBUG_LOG = os.getenv('ML_DEBUG', '').lower() == '1'

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
            edges_path = os.path.join(company_dir, "Edges (Plant).csv")
            legacy_edges_path = os.path.join(company_dir, "edges.csv")
            sales_path = os.path.join(company_dir, "Sales Order.csv")
            legacy_demand_path = os.path.join(company_dir, "demand.csv")
            
            data = {}
            
            if os.path.exists(sales_path):
                sales_df = pd.read_csv(sales_path)
                data['sales'] = sales_df
                # Backward compatibility: expose as demand as well
                data['demand'] = sales_df.copy()
            elif os.path.exists(legacy_demand_path):
                data['sales'] = pd.read_csv(legacy_demand_path)
                data['demand'] = data['sales'].copy()
            
            if os.path.exists(nodes_path):
                data['nodes'] = pd.read_csv(nodes_path)
                
            if os.path.exists(edges_path):
                data['edges'] = pd.read_csv(edges_path)
            elif os.path.exists(legacy_edges_path):
                data['edges'] = pd.read_csv(legacy_edges_path)
            
            return data if data else None
            
        except Exception as e:
            print(f"Error loading company data: {e}")
            return None


def normalize_sales_dataframe(df):
    """
    Convert various sales/demand CSV formats into a standard long format:
    columns -> ['date', 'product', 'demand']
    """
    if df is None or df.empty:
        return pd.DataFrame(columns=['date', 'product', 'demand'])

    frame = df.copy()
    lower_cols = {c.lower(): c for c in frame.columns}

    # Case 1: Wide format with Date + product columns (Sales Order.csv)
    if any(c.lower() == 'date' for c in frame.columns):
        date_col = next(c for c in frame.columns if c.lower() == 'date')
        product_cols = [c for c in frame.columns if c != date_col]
        if not product_cols:
            return pd.DataFrame(columns=['date', 'product', 'demand'])

        frame[date_col] = pd.to_datetime(frame[date_col], errors='coerce')
        long_df = frame.melt(id_vars=[date_col], value_vars=product_cols,
                             var_name='product', value_name='demand')
        long_df = long_df.dropna(subset=['demand'])
        long_df['demand'] = pd.to_numeric(long_df['demand'], errors='coerce').fillna(0.0)
        long_df.rename(columns={date_col: 'date'}, inplace=True)
        return long_df[['date', 'product', 'demand']]

    # Case 2: Already long format with node_id/product + date + demand columns
    node_col = lower_cols.get('node_id') or lower_cols.get('product') or lower_cols.get('store_id')
    date_col = lower_cols.get('date') or lower_cols.get('timestamp')
    demand_col = lower_cols.get('demand') or lower_cols.get('sales') or lower_cols.get('value')
    if node_col and date_col and demand_col:
        frame['product'] = frame[node_col].astype(str)
        frame['date'] = pd.to_datetime(frame[date_col], errors='coerce')
        frame['demand'] = pd.to_numeric(frame[demand_col], errors='coerce').fillna(0.0)
        return frame[['date', 'product', 'demand']].dropna(subset=['date'])

    # Case 3: Wide per-node with t1..tn columns
    timestep_cols = [c for c in frame.columns if c.lower().startswith('t') and c[1:].isdigit()]
    if node_col and timestep_cols:
        records = []
        for _, row in frame.iterrows():
            node_id = str(row[node_col])
            for idx, col in enumerate(sorted(timestep_cols, key=lambda x: int(x[1:]))):
                value = pd.to_numeric(row[col], errors='coerce')
                records.append({
                    'date': pd.Timestamp.now() - pd.Timedelta(days=len(timestep_cols) - idx),
                    'product': node_id,
                    'demand': float(value) if pd.notna(value) else 0.0
                })
        return pd.DataFrame(records)

    # Fallback: attempt to treat every column as product
    fallback_products = frame.columns.tolist()
    long_df = frame.melt(var_name='product', value_name='demand')
    long_df['date'] = pd.Timestamp.now()
    long_df['demand'] = pd.to_numeric(long_df['demand'], errors='coerce').fillna(0.0)
    return long_df[['date', 'product', 'demand']]

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "ML Service", "timestamp": datetime.now().isoformat()})

@app.route('/create-sample', methods=['POST'])
def create_sample_dataset():
    try:
        data = request.get_json(force=True)
        company_id = data.get('company_id')
        size = data.get('size', 'small')
        if not company_id:
            return jsonify({"error": "company_id is required"}), 400

        # Determine sample size
        num_nodes = 10 if size == 'small' else 30

        # Paths relative to Backend directory
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        company_dir = os.path.join(backend_dir, 'uploads', company_id)
        os.makedirs(company_dir, exist_ok=True)

        # Generate nodes.csv
        nodes = []
        for i in range(num_nodes):
            nodes.append({
                'node_id': f'NODE_{i:03d}',
                'node_type': 'store',
                'company': company_id
            })
        nodes_df = pd.DataFrame(nodes)
        nodes_path = os.path.join(company_dir, 'nodes.csv')
        nodes_df.to_csv(nodes_path, index=False)

        # Generate Edges (Plant).csv (Plant, node1, node2 format)
        edges = []
        for i in range(num_nodes - 1):
            edges.append({'Plant': '', 'node1': f'NODE_{i:03d}', 'node2': f'NODE_{i+1:03d}'})
        edges_df = pd.DataFrame(edges)
        edges_path = os.path.join(company_dir, 'Edges (Plant).csv')
        edges_df.to_csv(edges_path, index=False)

        # Generate Sales Order.csv (wide format: Date + product columns)
        dates = pd.date_range(start='2024-01-01', periods=30, freq='D')
        sales_rows = []
        rng = np.random.default_rng(42)
        
        for date in dates:
            row = {'Date': date.strftime('%Y-%m-%d')}
            for i in range(num_nodes):
                product = f'NODE_{i:03d}'
                base = 80 + (i % 5) * 25
                pattern = i % 5
                noise = rng.normal(0, 3)
                
                if pattern == 0:
                    v = base + (date.day % 30) * 0.2 + noise
                elif pattern == 1:
                    v = base - (date.day % 30) * 0.2 + noise
                elif pattern == 2:
                    v = base + 10 * np.sin(2 * np.pi * date.day / 15.0) + noise
                elif pattern == 3:
                    v = base - (date.day % 30) * 0.1 + noise
                else:
                    v = base + (date.day % 30) * 0.1 + noise
                
                row[product] = max(0.0, round(v, 2))
            sales_rows.append(row)
        
        sales_df = pd.DataFrame(sales_rows)
        sales_path = os.path.join(company_dir, 'Sales Order.csv')
        sales_df.to_csv(sales_path, index=False)

        return jsonify({
            'success': True,
            'company_id': company_id,
            'nodes': f'uploads/{company_id}/nodes.csv',
            'edges': f'uploads/{company_id}/Edges (Plant).csv',
            'sales': f'uploads/{company_id}/Sales Order.csv',
            'demand': f'uploads/{company_id}/Sales Order.csv'  # Backward compat
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
        sales_path = data.get('sales') or data.get('demand')
        force_retrain = data.get('force_retrain', False)
        
        if not company_id:
            return jsonify({"error": "company_id is required"}), 400
        
        if not nodes_path or not edges_path or not sales_path:
            return jsonify({"error": "nodes, edges, and sales paths are required"}), 400
        
        # Fix file paths - look relative to backend directory
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        nodes_full_path = os.path.join(backend_dir, nodes_path)
        edges_full_path = os.path.join(backend_dir, edges_path)
        sales_full_path = os.path.join(backend_dir, sales_path)
        
        # Start fine-tuning process with full paths
        result = trainer.fine_tune_company_model(
            company_id,
            nodes_full_path,
            edges_full_path,
            sales_full_path,
            force_retrain
        )

        # Normalise return payload from trainer (legacy versions return bool)
        success = False
        payload = {}
        if isinstance(result, dict):
            success = result.get("success", False)
            payload = result
        elif isinstance(result, bool):
            success = result
            payload = {
                "success": success,
                "company_id": company_id
            } if success else {}

        if success:
            return jsonify({
                **payload,
                "success": True,
                "message": payload.get("message", "Fine-tuning completed"),
                "company_id": company_id,
                "model_path": payload.get("model_path", f"atlas_model_{company_id}")
            })
        else:
            error_message = payload.get("error", "Fine-tuning failed")
            return jsonify({"error": error_message}), 500
    
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
        sales_path = data.get('sales') or data.get('demand')
        
        if not nodes_path or not edges_path or not sales_path:
            return jsonify({"error": "nodes, edges, and sales paths are required"}), 400
        
        # Fix file paths - look relative to backend directory
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        nodes_full_path = os.path.join(backend_dir, nodes_path)
        edges_full_path = os.path.join(backend_dir, edges_path)
        sales_full_path = os.path.join(backend_dir, sales_path)
        
        diagnosis = trainer.diagnose_training_data(nodes_full_path, edges_full_path, sales_full_path)
        
        return jsonify({
            "success": True,
            "diagnosis": diagnosis,
            "file_paths": {
                "nodes": nodes_full_path,
                "edges": edges_full_path,
                "sales": sales_full_path
            }
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/historical-data/<company_id>', methods=['GET'])
def get_historical_data(company_id):
    try:
        # Query params: product filter and interval days (aggregation)
        product = request.args.get('product')
        try:
            interval_days = int(request.args.get('intervalDays', '30'))
            interval_days = max(1, min(interval_days, 180))
        except ValueError:
            interval_days = 30
        # Load company data
        data_loader = DataLoader()
        company_data = data_loader.load_company_data(company_id)
        
        if not company_data:
            return jsonify({"error": "Company data not found"}), 404
        
        sales_df = company_data.get('sales')
        if sales_df is None:
            sales_df = company_data.get('demand')
        
        if sales_df is None or (hasattr(sales_df, 'empty') and sales_df.empty):
            return jsonify({"error": "No sales data found"}), 404
        
        # Handle Sales Order.csv format (Date + product columns)
        if 'Date' in sales_df.columns:
            sales_df['Date'] = pd.to_datetime(sales_df['Date'])
            sales_df = sales_df.sort_values('Date')
            
            product_cols = [c for c in sales_df.columns if c != 'Date']
            
            if product:
                # Filter to specific product
                if product in product_cols:
                    product_cols = [product]
                else:
                    return jsonify({"error": f"Product {product} not found"}), 404
            
            historical_data = []
            for _, row in sales_df.iterrows():
                date = row['Date']
                for prod in product_cols:
                    val = pd.to_numeric(row[prod], errors='coerce')
                    if not pd.isna(val) and val > 0:
                        historical_data.append({'date': date, 'demand': float(val), 'product': prod})
            
            if historical_data:
                df = pd.DataFrame(historical_data)
                df = df.sort_values('date').set_index('date')
                agg = df.groupby('product')['demand'].resample(f'{interval_days}D').sum().reset_index()
                chart_data = [{'date': d.strftime('%Y-%m-%d'), 'demand': float(v), 'product': p} 
                             for d, v, p in zip(agg['date'], agg['demand'], agg['product'])]
            else:
                chart_data = []
        # Handle long format (date, demand, node_id)
        elif {'date', 'demand'}.issubset(set([c.lower() for c in sales_df.columns])):
            cols = {c.lower(): c for c in sales_df.columns}
            df = sales_df.rename(columns={cols.get('date'): 'date', cols.get('demand'): 'demand'})
            if product and 'node_id' in df.columns:
                df = df[df['node_id'].astype(str).str.upper() == product.upper()]
            df['date'] = pd.to_datetime(df['date'])
            df = df.sort_values('date').set_index('date')
            agg = df['demand'].resample(f'{interval_days}D').sum().reset_index()
            chart_data = [{'date': d.strftime('%Y-%m-%d'), 'demand': float(v), 'product': product or 'All'} 
                         for d, v in zip(agg['date'], agg['demand'])]
        else:
            chart_data = []
        
        return jsonify({
            "company_id": company_id,
            "historical_data": chart_data,  # Return properly formatted data
            "total_records": len(chart_data),
            "interval_days": interval_days,
            "product": product
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/inventory/trending/<company_id>', methods=['GET'])
def get_trending_inventory(company_id):
    try:
        time_range = request.args.get('timeRange', '30d')
        
        # Load company data
        data_loader = DataLoader()
        company_data = data_loader.load_company_data(company_id)
        
        if not company_data:
            sales_df = None
        else:
            sales_df = company_data.get('sales')
            if sales_df is None:
                sales_df = company_data.get('demand')
        
        if sales_df is None or (hasattr(sales_df, 'empty') and sales_df.empty):
            return jsonify({
                "company_id": company_id,
                "time_range": time_range,
                "trending_items": [],
                "total_analyzed": 0,
                "error": "No sales data found"
            })
        
        # Handle Sales Order.csv format (Date + product columns)
        if 'Date' in sales_df.columns:
            product_cols = [c for c in sales_df.columns if c != 'Date']
            products = product_cols  # Process all products, filter later
        # Handle long format (node_id, date, demand)
        elif 'node_id' in sales_df.columns:
            products = sales_df['node_id'].unique()
        elif 'product' in sales_df.columns:
            products = sales_df['product'].unique()
        else:
            products = []
        
        trending_items = []
        
        for product in products:
            try:
                
                # Initialize variables
                sales_values = None
                product_data = None
                
                # Get RECENT average (last 30 days or last 10 data points) for current demand
                # This ensures we compare predictions against recent trends, not overall historical average
                if 'Date' in sales_df.columns:
                    if product in sales_df.columns:
                        # Sort by date to get recent values
                        df_sorted = sales_df.copy()
                        df_sorted['Date'] = pd.to_datetime(df_sorted['Date'], errors='coerce')
                        df_sorted = df_sorted.sort_values('Date')
                        
                        sales_values = pd.to_numeric(df_sorted[product], errors='coerce').dropna()
                        sales_values = sales_values[sales_values > 0]
                        
                        # Use recent average (last 10 data points or last 30 days worth)
                        recent_count = min(10, len(sales_values))
                        if recent_count > 0:
                            recent_values = sales_values.tail(recent_count)
                            historical_avg = float(recent_values.mean())
                        else:
                            historical_avg = float(sales_values.mean()) if len(sales_values) > 0 else 0
                    else:
                        continue
                # Handle long format
                elif 'node_id' in sales_df.columns:
                    product_data = sales_df[sales_df['node_id'] == product]
                    if 'demand' in product_data.columns:
                        # Sort by date if available
                        if 'date' in product_data.columns:
                            product_data = product_data.sort_values('date')
                        # Use recent average
                        recent_count = min(10, len(product_data))
                        if recent_count > 0:
                            historical_avg = float(product_data.tail(recent_count)['demand'].mean())
                        else:
                            historical_avg = float(product_data['demand'].mean())
                    else:
                        continue
                else:
                    continue
                
                # Get prediction for this product
                try:
                    prediction_result = predictor.predict(company_id, [{"node_type": "store", "company": company_id, "product": str(product)}])
                    matched_node = prediction_result.get('matched_node')
                    predicted_demand = prediction_result['prediction'][0] if prediction_result.get('prediction') else historical_avg
                    # If no matched node, skip to avoid using a generic fallback
                    if matched_node is None:
                        continue
                except Exception as pred_error:
                    if DEBUG_LOG:
                        print(f"Prediction failed for {product}: {pred_error}")
                    # Use a simple trend estimation if prediction fails
                    if 'Date' in sales_df.columns and product in sales_df.columns:
                        # Sales Order.csv format: use recent values
                        recent_values = pd.to_numeric(sales_df[product], errors='coerce').dropna().tail(3)
                        if len(recent_values) > 0:
                            recent_avg = float(recent_values.mean())
                            predicted_demand = recent_avg * 1.1  # Simple 10% growth assumption
                        else:
                            predicted_demand = historical_avg
                    elif 'node_id' in sales_df.columns:
                        # Long format: use product_data
                        product_data = sales_df[sales_df['node_id'] == product]
                        if len(product_data) > 1 and 'demand' in product_data.columns:
                            recent_avg = float(product_data.tail(3)['demand'].mean())
                            predicted_demand = recent_avg * 1.1  # Simple 10% growth assumption
                        else:
                            predicted_demand = historical_avg
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
                    # Calculate volatility from sales values
                    if sales_values is not None and len(sales_values) > 1:
                        # Sales Order.csv format: use the sales_values we already calculated
                        volatility = float(np.std(sales_values))
                        if historical_avg > 0:
                            volatility_ratio = volatility / historical_avg
                            risk_level = "high" if volatility_ratio > 0.5 else "medium" if volatility_ratio > 0.2 else "low"
                        else:
                            risk_level = "low"
                    elif product_data is not None and 'demand' in product_data.columns and len(product_data) > 1:
                        # Long format: calculate from demand column
                        demand_values = pd.to_numeric(product_data['demand'], errors='coerce').dropna()
                        if len(demand_values) > 1:
                            volatility = float(np.std(demand_values))
                            if historical_avg > 0:
                                volatility_ratio = volatility / historical_avg
                                risk_level = "high" if volatility_ratio > 0.5 else "medium" if volatility_ratio > 0.2 else "low"
                            else:
                                risk_level = "low"
                        else:
                            volatility = 0
                            risk_level = "low"
                    else:
                        volatility = 0
                        risk_level = "low"
                except (TypeError, ValueError, NameError) as e:
                    if DEBUG_LOG:
                        print(f"Error calculating volatility for {product}: {e}")
                    volatility = 0
                    risk_level = "low"
                
                trending_items.append({
                    'product': str(product),
                    'current_demand': int(round(historical_avg)),  # Round to integer
                    'predicted_demand': int(round(predicted_demand)),  # Round to integer
                    'current_sales': int(round(historical_avg)),
                    'predicted_sales': int(round(predicted_demand)),
                    'growth_rate': round(growth_rate, 2),
                    'trend_direction': trend_direction,
                    'risk_level': risk_level,
                    'volatility': round(volatility, 2),
                    'recommendation': get_recommendation(growth_rate, risk_level)
                })
                
            except Exception as e:
                if DEBUG_LOG:
                    print(f"Error processing product {product}: {e}")
                continue
        
        # Prioritize UP trends, but always return up to top 10 products overall
        up_trending = [item for item in trending_items if item['growth_rate'] > 0]
        up_trending.sort(key=lambda x: x['growth_rate'], reverse=True)
        
        # If fewer than 10 positive-growth products, backfill with the remaining highest-growth items
        if len(up_trending) >= 10:
            top_10 = up_trending[:10]
        else:
            selected_products = {item['product'] for item in up_trending}
            remaining_candidates = [
                item for item in trending_items
                if item['product'] not in selected_products
            ]
            remaining_candidates.sort(key=lambda x: x['growth_rate'], reverse=True)
            top_10 = up_trending + remaining_candidates[:max(0, 10 - len(up_trending))]
        
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
        # Load company data
        data_loader = DataLoader()
        company_data = data_loader.load_company_data(company_id)
        
        if not company_data:
            sales_df = None
        else:
            sales_df = company_data.get('sales')
            if sales_df is None:
                sales_df = company_data.get('demand')
        
        if sales_df is None or (hasattr(sales_df, 'empty') and sales_df.empty):
            return jsonify({
                "company_id": company_id,
                "summary": {
                    "total_products": 0,
                    "total_demand": 0,
                    "average_demand": 0,
                    "total_sales": 0,
                    "average_sales": 0,
                    "trending_up": 0,
                    "trending_down": 0,
                    "stable": 0
                },
                "error": "No sales data found"
            })
        
        # Handle Sales Order.csv format (Date + product columns)
        if 'Date' in sales_df.columns:
            product_cols = [c for c in sales_df.columns if c != 'Date']
            total_products = len(product_cols)
            sales_values = []
            for col in product_cols:
                vals = pd.to_numeric(sales_df[col], errors='coerce').dropna()
                sales_values.extend(vals[vals > 0].tolist())
            total_demand = sum(sales_values) if sales_values else 0
            avg_demand = total_demand / len(sales_values) if sales_values else 0
        # Handle long format (node_id, date, demand)
        elif 'node_id' in sales_df.columns:
            total_products = len(sales_df['node_id'].unique())
            if 'demand' in sales_df.columns:
                total_demand = float(sales_df['demand'].sum())
                avg_demand = float(sales_df['demand'].mean())
            else:
                total_demand = 0
                avg_demand = 0
        elif 'product' in sales_df.columns:
            total_products = len(sales_df['product'].unique())
            if 'demand' in sales_df.columns:
                total_demand = float(sales_df['demand'].sum())
                avg_demand = float(sales_df['demand'].mean())
            else:
                total_demand = 0
                avg_demand = 0
        else:
            total_products = 0
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




if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)