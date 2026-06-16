# SupplyGraph: STGT-Based Supply Chain Forecasting

A full-stack application that leverages **Spatio-Temporal Graph Transformers (STGT)** to provide accurate demand forecasting and autonomous inventory replenishment. The system models supply chain networks as spatial-temporal graphs, combining deep forecasting with multi-agent reorder automation.

## 🚀 Features

- **STGT (Spatio-Temporal Graph Transformer) Model**: Combines self-attention over temporal trends with graph transformer layers for superior forecasting accuracy.
- **Cognitive Command Center (Dashboard)**: Real-time tracking of neural engine status, forecast accuracies, products-at-risk, micro-trendlines, and interactive neural model diagnostic panels.
- **Reorder Intelligence Engine**: Combines STGT predictions with live inventory snapshots to compute Reorder Points (ROP), daily average demands, coverage days, suggested order quantities, and demand anomalies (Spikes/Drops).
- **Autonomous Multi-Agent Procurement**:
  - **Auditor Agent**: Scans reorder parameters (ROP, safety stock, lead times) and inventory positions to propose replenishment actions.
  - **Vendor Negotiator Agent**: Computes optimized order volumes against MOQ constraints and simulated bulk volume discount brackets, drafting automated negotiation emails for approval.
- **Team & Workspace Management**: Cryptographically signed invite-only token generation (7-day TTL) for teammates to link to the company account, with access revocation controls.
- **Role-Based Access Control (RBAC)**: Secure multi-tenant architecture with distinct User and Admin roles protecting data ingestion, STGT model retraining, and admin configuration endpoints.
- **Flexible Data Input**: Automatically converts wide, long, and single-dataset CSV formats to graph nodes and edges.
- **AWS DynamoDB & S3 Integration**: High-performance single-table DynamoDB for transactional metadata/invite records, and S3 for direct presigned-URL dataset ingestion and model weights storage.

## 🏗️ Architecture

The application is structured as a multi-tenant cloud-native system:

### Components

1. **Frontend** (React + Tailwind CSS)
   - Command Center Dashboard with live SVG telemetry and micro-animations.
   - Interactive Reorder Control Center for inventory uploads, proposal review, and order triggering.
   - Team space management UI (invite creation, active teammate rosters, revocation).
   - Historical analytical filters and node-specific forecasting charts.

2. **Backend** (Node.js + Express + DynamoDB)
   - RESTful API gateway with tenant isolation guards.
   - Role authentication via Google OAuth (Passport.js) and session state tracking.
   - Secure CSV ingestion via S3 presigned URLs, validation, and storage.
   - AWS SQS messaging client for job dispatch and Flask orchestration.

3. **ML Service** (Python + PyTorch + Flask)
   - Spatio-Temporal Graph Transformer (STGT) deep learning architectures.
   - Company-specific model fine-tuning and state transition tracking.
   - AWS S3 model weight synchronization and DynamoDB metadata/prediction caching.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **Python** (v3.8 or higher)
- **npm** or **yarn**
- **AWS Account** (for DynamoDB, S3 buckets, and SQS queue access)

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
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Session Configuration
SESSION_SECRET=your_secure_random_session_secret

# AWS & DynamoDB Configuration
AWS_REGION=us-east-1
DYNAMODB_TABLE=SupplyGraph-Prod
S3_MODELS_BUCKET=your_s3_models_bucket_here
SQS_QUEUE_URL=your_sqs_queue_url_here

# ML Service URL
ML_SERVICE_URL=http://localhost:5001
```

### 3. ML Service Setup

```bash
cd Backend/ml-service
pip install -r requirements.txt
```

The ML service uses the same AWS environment variables for DynamoDB and S3 access.

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

### Team & Invite Management
- `POST /api/invite/generate` - **(Admin Only)** Generate a secure 7-day invite link token
- `GET /api/invite/verify/:token` - Verify invitation token prior to registration
- `GET /api/company/members` - Retrieve roster of company members
- `DELETE /api/company/members/:id` - **(Admin Only)** Revoke teammate workspace access

### Data Processing
- `POST /api/data/convert/:companyId` - Convert raw CSV to structured format
- `POST /api/data/upload/:companyId` - Upload CSV file

### Reorder Intelligence
- `POST /api/reorder/snapshot/:companyId` - **(Admin Only)** Upload current inventory snapshot CSV
- `GET /api/reorder/snapshot/:companyId` - Fetch the company's uploaded inventory snapshot
- `GET /api/reorder/intelligence/:companyId` - Run telemetry engine combining snapshot & predictions
- `POST /api/reorder/trigger/:companyId/:productId` - **(Admin Only)** Stamped mark-ordered trigger for catalog product

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

### STGT (Spatio-Temporal Graph Transformer) Model

The model combines:

1. **Temporal Attention Component**: Processes temporal sequences
   - Learns patterns in time-series demand data using multi-head self-attention
   - Captures temporal trends across sliding windows of historical inputs
   - Projects temporal representations for each node

2. **Spatial Component (Graph Transformer)**: Processes supply chain graph structure
   - Captures relationships between nodes (plants, distributors, stores)
   - Uses multi-head Transformer convolutions to perform spatial message passing
   - Dynamically incorporates node type embeddings (Region, City, Store, Family)

3. **Spatio-Temporal Architecture**:
   ```
   Input (Time Series) → Temporal Attention + Node Embeddings → Graph Transformer Layers → Output
   ```

### Training Process

1. **Base Model**: Pre-trained on general supply chain patterns
2. **Fine-Tuning**: Adapts to company-specific data
3. **Storage**: Model weights stored in AWS S3, metadata and configurations stored in AWS DynamoDB

## 🔐 Security

- **Environment Variables**: All secrets stored in `.env` files (not committed)
- **OAuth Authentication**: Secure Google Sign-In
- **Session Management**: Express sessions with secure cookies
- **CORS**: Configured for frontend-backend communication
- **Input Validation**: Data validation on all endpoints

## 🔄 Workflow

1. Base model trained and stored in AWS S3
2. User (company) logs in via Google OAuth
3. User uploads dataset (single CSV or wide/long formats)
4. Backend splits and converts data into three files: `nodes.csv`, `edges.csv`, 
`demand.csv` and uploads them to S3
5. ML service fine-tunes the base STGT model for company-specific patterns via an SQS message queue
6. Start prediction: request demand forecasts for selected products
7. Inventory management dashboard shows top products, reorder points, and agent proposals

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
   - Verify AWS credentials and S3/DynamoDB permissions in environment variables

2. **Frontend Not Connecting to Backend**
   - Verify `REACT_APP_API_BASE` in Frontend `.env`
   - Check CORS settings in `Backend/server.js`
   - Ensure backend is running on port 5000

3. **Authentication Issues**
   - Verify Google OAuth credentials in `Backend/.env`
   - Check callback URL matches Google Cloud Console settings
   - See `Backend/OAUTH_SETUP.md` for detailed setup

4. **AWS / DynamoDB Connection Errors**
   - Verify local AWS credentials (`~/.aws/credentials`) or environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
   - Check `DYNAMODB_TABLE`, `S3_MODELS_BUCKET` and `SQS_QUEUE_URL` are set correctly
   - Verify network access to AWS services

## 📚 Documentation

- **Interview Prep & Audit Guide**: [INTERVIEW_AUDIT_GUIDE.md](file:///C:/Users/AKIF/.gemini/antigravity-ide/brain/6810b4eb-a8ba-4948-965a-6e4659c3eaf9/interview_audit_guide.md) - Detailed system audit and prep questions for technical architecture interviews
- **Deployment Guide**: [DEPLOYMENT_GUIDE.md](file:///c:/PROJECTS/SupplyChain/GNN_SupplyChainForecasting/DEPLOYMENT_GUIDE.md) - Deep-dive infrastructure, scale strategy, and DevOps interview concepts
- **Backend README**: [Backend README.md](file:///c:/PROJECTS/SupplyChain/GNN_SupplyChainForecasting/SupplyGraph/Backend/README.md) - Detailed backend architecture
- **OAuth Setup**: [OAuth Setup Guide](file:///c:/PROJECTS/SupplyChain/GNN_SupplyChainForecasting/SupplyGraph/Backend/OAUTH_SETUP.md) - Google OAuth configuration guide
- **Frontend README**: [Frontend README.md](file:///c:/PROJECTS/SupplyChain/GNN_SupplyChainForecasting/SupplyGraph/Frontend/README.md) - Frontend setup and usage


## 📝 License

This project is licensed under the ISC License.

## 👥 Authors

- **Mohammed Akif Ali Parvez** - [@Akifali-1](https://github.com/Akifali-1)


## 📧 Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Built with ❤️ using STGT for Supply Chain Forecasting**

