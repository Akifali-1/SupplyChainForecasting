# SupplyGraph: GNN-Based Supply Chain Forecasting

A full-stack application that leverages **Graph Attention Networks (GAT) combined with LSTM** to provide accurate demand forecasting for supply chain management. The system uses graph neural networks to model supply chain relationships and predict future demand with high accuracy.

## 🚀 Features

- **GAT+LSTM Hybrid Model**: Combines Graph Attention Networks with LSTM for superior forecasting accuracy
- **Flexible Data Input**: Supports multiple CSV formats
- **Fine-Tuning**: Company-specific model fine-tuning on uploaded data
- **Real-Time Predictions**: Get demand forecasts with confidence scores
- **Historical Analytics**: Visualize historical demand data with product filtering and time aggregation
- **Inventory Management**: Analyze and get a structured way to analyze your Inventory
- **Modern UI**: Beautiful, responsive interface built with React and Tailwind CSS
- **MongoDB Atlas Integration**: Cloud-based model storage and retrieval 

## 🏗️ Architecture

The application consists of three main components:


### Components

1. **Frontend** (React + Tailwind CSS)
   - User authentication and registration
   - Data upload interface
   - Prediction dashboard with charts
   - Historical data visualization
   - Inventory Management

2. **Backend** (Node.js + Express)
   - RESTful API endpoints
   - OAuth authentication handling
   - File upload and processing
   - ML service proxy

3. **ML Service** (Python + Flask)
   - GAT+LSTM model training and fine-tuning
   - Demand prediction
   - Data preprocessing and validation
   - Model storage/retrieval from MongoDB Atlas

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **Python** (v3.8 or higher)
- **npm** or **yarn**
- **pip** (Python package manager)
- **MongoDB Atlas** account (for cloud database)

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/MukarramUddin09/GNN_SupplyChainForecasting.git
cd GNN_SupplyChainForecasting/SupplyGraph
```

### 2. Backend Setup

```bash
cd Backend
npm install
```

**Environment Variables** - Create a `.env` file in the `Backend` directory:

```env
# MongoDB Configuration
MONGO_URI=your_mongodb_atlas_connection_string
MONGO_DB=supplychain

# Session Configuration
SESSION_SECRET=your_secure_random_session_secret

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```


### 3. ML Service Setup

```bash
cd Backend/ml-service
pip install -r requirements.txt
```

The ML service uses the same `MONGO_URI` from environment variables.

### 4. Frontend Setup

```bash
cd Frontend
npm install
```

**Environment Variables** - Create a `.env` file in the `Frontend` directory:

```env
REACT_APP_API_BASE=http://localhost:5000
```

## 🚦 Running the Application

You need to run all three services simultaneously:

#### Terminal 1: Backend Server
```bash
cd Backend
npm start
# Server runs on http://localhost:5000
```

#### Terminal 2: ML Service
```bash
cd Backend/ml-service
python app.py or py app.py
# ML service runs on http://localhost:5001
```

#### Terminal 3: Frontend
```bash
cd Frontend
npm start
# Frontend runs on http://localhost:3000
```

## 📊 Data Formats

The system supports multiple CSV input formats:

### Format 1: Wide Format (Date + Product Columns)
```csv
Date,Product1,Product2,Product3
2024-01-01,120,150,200
2024-02-01,130,160,210
```

### Format 2: Long Format
```csv
node_id,type,date,demand
NODE_001,store,2024-01-01,120
NODE_001,store,2024-02-01,130
```

### Format 3: Single Dataset (Plant + Distributor + Store + Products)
```csv
Date,Plant,node1,node2,PRODUCT_A,PRODUCT_B
2024-01-01,PLANT_NYC,DIST_WEST,STORE_001,120,150
```

The system automatically detects and converts data to the required format (nodes.csv, edges.csv, demand.csv).

## 📡 API Endpoints

### Authentication
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback
- `GET /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Data Processing
- `POST /api/data/convert/:companyId` - Convert raw CSV to structured format
- `POST /api/data/upload/:companyId` - Upload CSV file

### ML Operations
- `POST /api/ml/fine-tune/:companyId` - Fine-tune model on company data
- `POST /api/ml/predict/:companyId` - Generate demand predictions
- `GET /api/ml/training-status/:companyId` - Check training status
- `GET /api/ml/model-info/:companyId` - Get model information
- `GET /api/ml/validate-data/:companyId` - Validate uploaded data
- `GET /api/ml/historical-data/:companyId` - Get historical demand data
- `GET /api/ml/health` - ML service health check

### Company Management
- `POST /api/company/register` - Register a new company

## 🧠 Model Architecture

### GAT+LSTM Hybrid Model

The model combines:

1. **Graph Attention Network (GAT)**: Processes supply chain graph structure
   - Captures relationships between nodes (plants, distributors, stores)
   - Attention mechanism focuses on relevant connections
   - Handles variable graph structures

2. **LSTM (Long Short-Term Memory)**: Processes temporal sequences
   - Learns patterns in time-series demand data
   - Captures long-term dependencies
   - Handles variable sequence lengths

3. **Hybrid Architecture**:
   ```
   Input (Time Series) → LSTM → Graph Features → GAT Layers → Output
   ```

### Training Process

1. **Base Model**: Pre-trained on general supply chain patterns
2. **Fine-Tuning**: Adapts to company-specific data
3. **Storage**: Models stored in MongoDB Atlas via GridFS

## 🔐 Security

- **Environment Variables**: All secrets stored in `.env` files (not committed)
- **OAuth Authentication**: Secure Google Sign-In
- **Session Management**: Express sessions with secure cookies
- **CORS**: Configured for frontend-backend communication
- **Input Validation**: Data validation on all endpoints

## 🔄 Workflow

1. Base model trained in Colab and saved to MongoDB Atlas
2. User (company) logs in via Google OAuth
3. User uploads dataset (single CSV or wide/long formats)
4. Backend splits and converts data into three files: `nodes.csv`, `edges.csv`, 
`demand.csv`
5. ML service fine-tunes the base GAT+LSTM for company-specific patterns
6. Start prediction: request demand forecasts for selected products
7. Inventory management dashboard shows top products and trends

## 🧪 Testing

### Test Data

Sample datasets are available in `Backend/test_data/`:
- `realworld_single_dataset.csv`

### Manual Testing

1. Register a company 
2. Upload a CSV file
3. Fine-tune the model
4. Generate predictions
5. View historical data

## 🔧 Troubleshooting

### Common Issues

1. **ML Service Not Starting**
   - Check Python version (`python --version`)
   - Ensure all dependencies installed: `pip install -r requirements.txt`
   - Verify MongoDB connection string in environment variables

2. **Frontend Not Connecting to Backend**
   - Verify `REACT_APP_API_BASE` in Frontend `.env`
   - Check CORS settings in `Backend/server.js`
   - Ensure backend is running on port 5000

3. **Authentication Issues**
   - Verify Google OAuth credentials in `Backend/.env`
   - Check callback URL matches Google Cloud Console settings
   - See `Backend/OAUTH_SETUP.md` for detailed setup

4. **MongoDB Connection Errors**
   - Verify `MONGO_URI` is correctly set
   - Check network access (MongoDB Atlas whitelist)
   - Ensure database name is correct

## 📚 Documentation

- **Backend README**: `Backend/README.md` - Detailed backend architecture
- **OAuth Setup**: `Backend/OAUTH_SETUP.md` - Google OAuth configuration guide
- **Frontend README**: `Frontend/README.md` - Frontend setup and usage


## 📝 License

This project is licensed under the ISC License.

## 👥 Authors

- **Mohammed Akif Ali Parvez** - [@Akifali-1](https://github.com/Akifali-1)


## 📧 Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Built with ❤️ using GAT+LSTM for Supply Chain Forecasting**

