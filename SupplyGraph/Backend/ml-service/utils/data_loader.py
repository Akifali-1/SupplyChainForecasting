import pandas as pd
import numpy as np
import os
import json
from datetime import datetime

class DataLoader:
    def __init__(self):
        self.upload_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
        
    def load_company_data(self, company_id):
        """Load all data files for a company"""
        try:
            company_path = os.path.join(self.upload_path, company_id)
            
            if not os.path.exists(company_path):
                raise Exception(f"Company directory not found: {company_path}")
            
            # Load nodes
            nodes_path = os.path.join(company_path, "nodes.csv")
            if os.path.exists(nodes_path):
                nodes_df = pd.read_csv(nodes_path)
            else:
                raise Exception(f"Nodes file not found: {nodes_path}")
            
            # Load edges
            edges_path = os.path.join(company_path, "edges.csv")
            if os.path.exists(edges_path):
                edges_df = pd.read_csv(edges_path)
            else:
                raise Exception(f"Edges file not found: {edges_path}")
            
            # Load demand
            demand_path = os.path.join(company_path, "demand.csv")
            if os.path.exists(demand_path):
                demand_df = pd.read_csv(demand_path)
            else:
                raise Exception(f"Demand file not found: {demand_path}")
            
            return {
                "nodes": nodes_df,
                "edges": edges_df,
                "demand": demand_df,
                "metadata": self._get_data_metadata(nodes_df, edges_df, demand_df)
            }
            
        except Exception as e:
            print(f"Error loading company data: {e}")
            return None
    
    def _get_data_metadata(self, nodes_df, edges_df, demand_df):
        """Extract metadata from data files"""
        try:
            return {
                "node_count": len(nodes_df),
                "edge_count": len(edges_df),
                "demand_records": len(demand_df),
                "node_types": nodes_df['node_type'].unique().tolist() if 'node_type' in nodes_df.columns else [],
                "edge_types": edges_df['edge_type'].unique().tolist() if 'edge_type' in edges_df.columns else [],
                "products": demand_df['product'].unique().tolist() if 'product' in demand_df.columns else [],
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            print(f"Error extracting metadata: {e}")
            return {}
    
    def validate_data_quality(self, company_data):
        """Validate the quality of uploaded data"""
        try:
            validation_results = {
                "is_valid": True,
                "errors": [],
                "warnings": [],
                "score": 100
            }
            
            nodes_df = company_data["nodes"]
            edges_df = company_data["edges"]
            demand_df = company_data["demand"]
            
            # Check for missing values
            if nodes_df.isnull().any().any():
                validation_results["errors"].append("Nodes contain missing values")
                validation_results["score"] -= 20
            
            if edges_df.isnull().any().any():
                validation_results["errors"].append("Edges contain missing values")
                validation_results["score"] -= 20
            
            if demand_df.isnull().any().any():
                validation_results["errors"].append("Demand contains missing values")
                validation_results["score"] -= 20
            
            # Check data consistency
            if len(nodes_df) < 10:
                validation_results["warnings"].append("Very few nodes - may affect model performance")
                validation_results["score"] -= 10
            
            if len(edges_df) < 20:
                validation_results["warnings"].append("Very few edges - may affect model performance")
                validation_results["score"] -= 10
            
            if len(demand_df) < 5:
                validation_results["warnings"].append("Very few demand records - may affect model performance")
                validation_results["score"] -= 10
            
            # Check for orphaned nodes
            all_node_ids = set(nodes_df['node_id'])
            source_nodes = set(edges_df['source_id'])
            target_nodes = set(edges_df['target_id'])
            connected_nodes = source_nodes.union(target_nodes)
            orphaned_nodes = all_node_ids - connected_nodes
            
            if len(orphaned_nodes) > 0:
                validation_results["warnings"].append(f"Found {len(orphaned_nodes)} orphaned nodes")
                validation_results["score"] -= 5
            
            # Update validation status
            if len(validation_results["errors"]) > 0:
                validation_results["is_valid"] = False
            
            validation_results["score"] = max(0, validation_results["score"])
            
            return validation_results
            
        except Exception as e:
            return {
                "is_valid": False,
                "errors": [f"Validation failed: {str(e)}"],
                "warnings": [],
                "score": 0
            }
    
    def create_sample_dataset(self, size="small"):
        """Create a sample dataset for testing"""
        try:
            if size == "small":
                num_nodes = 50
                num_edges = 100
                num_demand = 30
            elif size == "medium":
                num_nodes = 200
                num_edges = 400
                num_demand = 100
            else:
                num_nodes = 100
                num_edges = 200
                num_demand = 50
            
            # Create sample nodes
            nodes_data = []
            for i in range(num_nodes):
                node_type = "store" if i < num_nodes // 3 else "warehouse" if i < 2 * num_nodes // 3 else "supplier"
                nodes_data.append({
                    "node_id": f"node_{i:03d}",
                    "node_type": node_type,
                    "company": "sample_company",
                    "product": "sample_product"
                })
            
            # Create sample edges
            edges_data = []
            for i in range(num_edges):
                source = f"node_{(i % num_nodes):03d}"
                target = f"node_{((i + 1) % num_nodes):03d}"
                edges_data.append({
                    "source_id": source,
                    "target_id": target,
                    "edge_type": "ship",
                    "company": "sample_company",
                    "product": "sample_product"
                })
            
            # Create sample demand
            demand_data = []
            for i in range(num_demand):
                store_id = f"node_{(i % (num_nodes // 3)):03d}"
                demand_data.append({
                    "store_id": store_id,
                    "product": "sample_product",
                    "demand": np.random.randint(10, 100)
                })
            
            return {
                "nodes": pd.DataFrame(nodes_data),
                "edges": pd.DataFrame(edges_data),
                "demand": pd.DataFrame(demand_data)
            }
            
        except Exception as e:
            print(f"Error creating sample dataset: {e}")
            return None
    
    def save_sample_dataset(self, company_id, data):
        """Save sample dataset to company directory"""
        try:
            company_path = os.path.join(self.upload_path, company_id)
            os.makedirs(company_path, exist_ok=True)
            
            # Save nodes
            nodes_path = os.path.join(company_path, "nodes.csv")
            data["nodes"].to_csv(nodes_path, index=False)
            
            # Save edges
            edges_path = os.path.join(company_path, "edges.csv")
            data["edges"].to_csv(edges_path, index=False)
            
            # Save demand
            demand_path = os.path.join(company_path, "demand.csv")
            data["demand"].to_csv(demand_path, index=False)
            
            return {
                "nodes": nodes_path,
                "edges": edges_path,
                "demand": demand_path
            }
            
        except Exception as e:
            print(f"Error saving sample dataset: {e}")
            return None 