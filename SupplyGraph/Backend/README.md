# SupplyGraph Backend

The backend server for the SupplyGraph application, providing RESTful API endpoints, authentication, data processing, and ML service integration.

## 🏗️ Architecture

The backend consists of two main services:

1. **Node.js/Express Server** - Main API server handling HTTP requests
2. **Python/Flask ML Service** - Machine learning operations (training, prediction)

```
┌─────────────────┐      ┌──────────────────┐
│   Express API   │──────│   Flask ML       │
│   (Port 5000)   │      │   Service        │
│                 │      │   (Port 5001)    │
└─────────────────┘      └──────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
            ┌─────────────────┐
            │  MongoDB Atlas  │
            │  (Cloud DB)     │
            └─────────────────┘
```

## 📦 Dependencies

### Node.js Dependencies
- **express** - Web framework
- **mongoose** - MongoDB ODM
- **passport** - Authentication middleware
- **passport-google-oauth20** - Google OAuth strategy
- **express-session** - Session management
- **multer** - File upload handling
- **cors** - Cross-origin resource sharing
- **axios** - HTTP client for ML service communication

### Python Dependencies
See `ml-service/requirements.txt` for full list:
- **torch** - PyTorch for deep learning
- **torch-geometric** - Graph neural networks
- **flask** - Web framework for ML service
- **pandas** - Data manipulation
- **pymongo** - MongoDB driver

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd Backend
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the `Backend` directory:

```env
# MongoDB Configuration
MONGO_URI=your_mongodb_atlas_connection_string
MONGO_DB=supplychain

# Session Configuration
SESSION_SECRET=your_secure_random_session_secret

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# ML Service Configuration (optional)
ML_SERVICE_URL=http://localhost:5001
```


### 3. Set Up ML Service

```bash
cd ml-service
pip install -r requirements.txt
```

### 4. Start the Server

```bash
# Start Express server
npm start

# Start ML service (in separate terminal)
cd ml-service
python app.py
```

## 📡 API Endpoints


### Data Processing
- `POST /api/data/convert/:companyId` - Convert raw CSV to structured format (nodes.csv, edges.csv, demand.csv)
- `POST /api/data/upload/:companyId` - Upload CSV file (multipart/form-data)

### ML Operations
- `POST /api/ml/fine-tune/:companyId` - Fine-tune GAT+LSTM model on company data
- `POST /api/ml/predict/:companyId` - Generate demand predictions
- `GET /api/ml/training-status/:companyId` - Check model training status
- `GET /api/ml/model-info/:companyId` - Get model metadata and information
- `GET /api/ml/validate-data/:companyId` - Validate uploaded CSV data
- `GET /api/ml/historical-data/:companyId` - Get historical demand data (supports filtering by product and time aggregation)
- `GET /api/ml/health` - ML service health check

### Company Management
- `POST /api/company/register` - Register a new company


## 📊 Data Flow

```
1. User Uploads CSV
   ↓
2. dataProcessor.js converts to structured format
   ↓
3. Files stored in uploads/{companyId}/
   ├── nodes.csv (supply chain nodes)
   ├── edges.csv (supply chain relationships)
   └── demand.csv (time-series demand data)
   ↓
4. ML Service receives data paths
   ↓
5. Model fine-tuning on company data
   ↓
6. Fine-tuned model stored in MongoDB Atlas
   ↓
7. Predictions generated using company model
```


## 🔧 Data Processing

The `dataProcessor.js` utility handles multiple CSV input formats:

### Supported Formats:
1. **Wide Format**: Date column + product columns
2. **Long Format**: node_id, type, date, demand
3. **Single Dataset**: Date, Plant, Distributor, Store, Product columns

### Output Format:
Always produces three files:
- `nodes.csv` - Supply chain nodes (id, type)
- `edges.csv` - Relationships (source, target)
- `demand.csv` - Time-series demand (node_id, type, date, demand)

## 🧠 ML Service Integration

The ML service runs as a separate Flask application on port 5001.

### Model Architecture: GAT+LSTM Hybrid

1. **LSTM Layer**: Processes temporal sequences
2. **GAT Layers**: Graph attention over supply chain structure
3. **Output**: Demand predictions per node

### Training Process:
1. Load base model from MongoDB Atlas
2. Fine-tune on company-specific data
3. Save fine-tuned model back to Atlas (GridFS)
4. Store metadata in company_models collection

## 🔐 Security

- **Environment Variables**: All secrets in `.env` (never committed)
- **OAuth**: Google Sign-In via Passport.js
- **Session Management**: Secure Express sessions
- **CORS**: Configured for frontend origin
- **Input Validation**: All endpoints validate input data

## 🧪 Testing

### Test Data
Sample datasets available in `test_data/`:
- `realworld_single_dataset.csv` - Realistic supply chain data

## 🔧 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Verify `MONGO_URI` in `.env`
   - Check MongoDB Atlas network access (IP whitelist)
   - Ensure database name is correct

2. **ML Service Not Responding**
   - Verify ML service is running on port 5001
   - Check `ML_SERVICE_URL` environment variable
   - Review ML service logs for errors

3. **OAuth Not Working**
   - Verify Google OAuth credentials in `.env`
   - Check callback URL matches Google Cloud Console
   - See `OAUTH_SETUP.md` for detailed setup

4. **File Upload Errors**
   - Check `uploads/` directory permissions
   - Verify company ID exists
   - Ensure CSV format is supported

## 📚 Related Documentation

- **Main README**: `../README.md` - Project overview
- **OAuth Setup**: `OAUTH_SETUP.md` - Google OAuth configuration
- **Frontend README**: `../Frontend/README.md` - Frontend setup

## 🛠️ Development

### Running in Development Mode

```bash
# Use nodemon for auto-reload
npm run dev
```

### Environment Variables for Development

```env
MONGO_URI=mongodb+srv://...
MONGO_DB=supplychain
SESSION_SECRET=dev_secret_key
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ML_SERVICE_URL=http://localhost:5001
```

## 📝 Notes

- The backend uses **GAT+LSTM** exclusively (SimpleGCN removed)
- Base model ID is standardized: `"base_gat_lstm_model"`
- All model storage uses MongoDB GridFS for large files
- CSV processing handles multiple formats automatically
- ML service logging controlled by `ML_DEBUG` environment variable

---

**Built with Node.js, Express, and Python Flask**
