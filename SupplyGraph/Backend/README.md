# SupplyGraph Backend

## **Simplified Architecture (No Company Management)**

### **What We Store Where:**

#### **1. MongoDB Atlas (Cloud Database)**
- ✅ **Models Collection** - Base GCN model (shared)
- ✅ **Company Models Collection** - Fine-tuned models per company

#### **2. Local File System (uploads/)**
- ✅ **Raw CSV files** - User uploads
- ✅ **Processed CSV files** - nodes.csv, edges.csv, demand.csv

### **Key Benefits:**
- ✅ **Simple** - No unnecessary company tracking
- ✅ **Direct** - Just file processing and ML operations
- ✅ **Clean** - Minimal code, maximum functionality
- ✅ **Working** - Core ML functionality intact

## **Data Flow:**

```
User Upload → Process CSV → Fine-tune → Store Model in Atlas
     ↓           ↓           ↓         ↓
  Raw CSV    Convert to    ML      Company Model
              Structured   Service  (with company_id)
```

## **API Endpoints:**

### **Data Processing**
- `POST /api/data/convert/:companyId` - Process raw CSV to structured format

### **ML Operations**
- `POST /api/ml/create-sample/:companyId` - Generate sample dataset
- `POST /api/ml/fine-tune/:companyId` - Fine-tune model (requires nodes, edges, demand in body)
- `POST /api/ml/predict/:companyId` - Make predictions
- `GET /api/ml/health` - ML service health check
- `GET /api/ml/training-status/:companyId` - Check training status
- `GET /api/ml/model-info/:companyId` - Get model information
- `GET /api/ml/validate-data/:companyId` - Validate company data

## **Database Schema:**

### **Company Models Collection (in Atlas)**
```javascript
{
  _id: ObjectId,
  company_id: String,  // From API parameter
  base_model_id: String,
  model_type: String,  // "finetuned"
  model_data: Binary,  // Serialized PyTorch model
  feature_columns: Array,
  metrics: Object,
  created_at: Date
}
```

## **Setup:**

1. **Install Dependencies**: `npm install`
2. **Start Backend**: `npm start` or `node server.js`
3. **Start ML Service**: `cd ml-service && python app.py`

## **Usage:**

### **1. Process Raw CSV**
```bash
POST /api/data/convert/{company_id}
# Upload CSV file, get processed nodes/edges/demand paths
```

### **2. Fine-tune Model**
```bash
POST /api/ml/fine-tune/{company_id}
Body: {
  "nodes": "path/to/nodes.csv",
  "edges": "path/to/edges.csv", 
  "demand": "path/to/demand.csv"
}
```

### **3. Make Predictions**
```bash
POST /api/ml/predict/{company_id}
Body: {
  "input_data": {...}
}
```

## **Why This is Perfect:**

1. **✅ Simple** - No unnecessary complexity
2. **✅ Direct** - Straight to ML operations
3. **✅ Clean** - Minimal codebase
4. **✅ Working** - Core functionality intact
5. **✅ Scalable** - Easy to add features

## **What We Removed (Unnecessary):**

- ❌ Company model and validation
- ❌ Company status tracking
- ❌ Complex file management
- ❌ Unnecessary database operations

## **What We Kept (Essential):**

- ✅ File upload and processing
- ✅ ML service integration
- ✅ Model storage in Atlas
- ✅ Simple API endpoints

The system is now **clean, simple, and focused** on what actually matters - ML operations! 🎯
