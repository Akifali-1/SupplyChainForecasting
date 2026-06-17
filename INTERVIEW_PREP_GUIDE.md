# SupplyGraph: Comprehensive Technical Interview & System Architecture Guide

This guide is designed to help you explain the **SupplyGraph** system from scratch in high-profile technical, ML engineering, full-stack, and DevOps interviews. It details the system's architecture, ML mechanics, multi-agent automation, cloud infrastructure, and common scenario questions with sample answers.

---

## 🎙️ 1. How to Pitch the Project ("The 2-Minute Elevator Script")

*When an interviewer says: **"Tell me about a complex project you built and how it works,"** start with this script:*

> "I designed and built **SupplyGraph**, a production-ready, full-stack supply chain forecasting and autonomous procurement platform. 
>
> The core problem in supply chains is that standard forecasting methods (like ARIMA or simple LSTMs) treat products and stores as isolated time series, ignoring spatial dependencies like warehouse-to-store relationships or regional networks.
>
> To solve this, **SupplyGraph** models the supply chain as a **Spatio-Temporal Graph** and runs a hybrid deep learning model: a **Spatio-Temporal Graph Transformer (STGT)**. It uses **Temporal Attention** to extract time-series demand patterns and a **Spatial Graph Transformer** (using PyTorch Geometric) to perform message-passing across nodes like plants, distributors, and stores.
> 
> Once predictions are generated, a **multi-agent orchestrator** executes autonomous inventory replenishment. A **Procurement Auditor Agent** scans current inventory positions against safety stocks and predicted demand to flag stockout risks. Then, a **Vendor Negotiator Agent** automatically resolves vendor constraints, adjusts order volumes to meet Minimum Order Quantities (MOQ), auto-bumps quantities if they are within 25% of discount brackets to secure savings, and uses **Gemini 1.5 Flash** to draft simulated vendor negotiation email threads.
> 
> Architecturally, it is a multi-tenant cloud-native system built with **React** on the frontend, a **Node.js Express API Gateway** backed by **DynamoDB (Single-Table Design)** and **S3**, and a **Python/PyTorch Flask ML microservice** communicating asynchronously via **Amazon SQS**."

---

## 🏗️ 2. Comprehensive System Architecture

SupplyGraph uses a decoupled, three-tier cloud topology designed for low latency, secure authentication, and resilient long-running execution.

```
                           ┌─────────────────────────┐
                           │      DNS / Client       │
                           └────────────┬────────────┘
                                        │
                                        ▼ (HTTPS)
                          ┌───────────────────────────┐
                          │    AWS CloudFront CDN     │
                          └──────┬─────────────┬──────┘
                                 │             │
                  (Static Assets)│             │(API Requests `/api/*`)
                                 ▼             ▼
                         ┌───────────┐   ┌───────────────────────────┐
                         │ AWS S3    │   │ AWS EC2 (t3.small)        │
                         │ Frontend  │   │                           │
                         │ (Private) │   │  ┌─────────────────────┐  │
                         └───────────┘   │  │ Nginx Reverse Proxy │  │
                                         │  │ (Port 80 -> Proxy)  │  │
                                         │  └──────────┬──────────┘  │
                                         │             │             │
                                         │             ▼ (Docker network)
                                         │  ┌─────────────────────┐  │
                                         │  │ Node.js Backend     │  │
                                         │  │ (Port 5000)         │  │
                                         │  └────┬───────────┬────┘  │
                                         │       │           │       │
                                         │       │           ▼       │
                                         │       │   ┌────────────┐  │
                                         │       │   │ ML Flask   │  │
                                         │       │   │ (Port 5001)│  │
                                         │       │   └─────┬──────┘  │
                                         └───────┼─────────┼─────────┘
                                                 │         │
                       ┌─────────────────────────┼─────────┼────────────────────────┐
                       │ Managed Cloud Services  │         │                        │
                       │                         ▼         ▼                        │
                       │    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │
                       │    │   AWS SQS    │   │  AWS S3      │   │  Amazon      │  │
                       │    │  (ML Jobs)   │   │  (Uploads &  │   │  DynamoDB    │  │
                       │    │              │   │   Models)    │   │  (Single     │  │
                       │    └──────────────┘   └──────────────┘   └──────────────┘  │
                       └────────────────────────────────────────────────────────────┘
```

### 1. Frontend Client Tier (React + Tailwind CSS + Three.js)
* **Visual Premium**: Custom-designed landing and dashboard UI using glassmorphic panels, animated SVG nodes mapping telemetry, and interactive model diagnostic panels.
* **Three.js Wave Background**: The hero landing section uses a WebGL-powered 3D interactive particle simulation to immediately capture the user's attention.
* **Data Flow**: Direct client-side calls to the Nginx reverse proxy endpoint. Utilizes React Context API to manage themes and session states.

### 2. API Gateway & Tenant Router (Node.js + Express)
* **Authentication**: Leverages Passport.js for secure Google OAuth.
* **Role-Based Access Control (RBAC)**: Distinguishes between `Admin` and `User` roles. Retraining triggers, invite link creations, and ordering requests are strictly gated via role middleware.
* **Invite Sub-System**: Allows Admins to generate secure, cryptographically signed invitation tokens with a 7-day TTL. When used, it maps the new registration to the same `CompanyId` tenant partition.
* **Storage Dispatch**: Generates S3 presigned URLs for client-side uploads, keeping the Node.js process lean and avoiding server memory overload from large files.

### 3. ML Processing Service (Python + Flask + PyTorch)
* **STGT Neural Engine**: Custom deep-learning architecture implementing Spatio-Temporal Graph Transformers.
* **Asynchronous Jobs**: Integrates with AWS SQS. Since training runs take time, Node.js pushes a message onto SQS and immediately returns a success status. The Flask service polls SQS, locks the message, performs training, and updates DynamoDB.
* **Weight Persistence**: Serializes PyTorch weights using `pickle` and stores them in AWS S3 under `models/{CompanyId}/model_weights.pkl`.

---

## 🧠 3. Deep-Dive: Spatio-Temporal Graph Transformer (STGT)

### Why Use a Spatio-Temporal Graph Transformer?
Standard time-series models fail to capture relational paths (e.g., store $A$ is supplied by distributor $B$ which is supplied by plant $C$). A Graph Neural Network (GNN) can represent this network structure but typically ignores time.
The STGT model combines both dimensions in a single unified architecture.

```
Input (Time Series) 
   │
   ▼
[Temporal Attention]  ──► [Pool across Time] ─┐
                                              ├─► [Sum] ─► [Spatial Graph Transformer] ─► Prediction
[Node Type Embedding] ────────────────────────┘              (TransformerConv Layers)
```

### The Architecture: Step-by-Step

#### Step 1: Temporal Attention (Temporal Encoder)
For each node in the supply chain graph, the model receives a historical window of sales data of size `max_timesteps` (default: 14 days).
* **Self-Attention**: Uses PyTorch's `nn.TransformerEncoder` with multi-head self-attention (`nhead=2`).
* **Positional Encoding**: Learns temporal order by adding a trainable positional parameter:
  $$\mathbf{x}_{\text{pos}} = \mathbf{X} \cdot \mathbf{W}_{\text{proj}} + \mathbf{E}_{\text{pos}}$$
* **Temporal Pooling**: Transposes and pools across the time dimension using a linear layer (`output_pooling`) to condense the sequence into a single $d$-dimensional spatial feature vector per node: $[num\_nodes, d\_model]$ (where $d\_model = 64$).

#### Step 2: Spatial Node Type Embeddings
A supply chain consists of different types of nodes (e.g., Region, City, Store, Plant, Product). 
* The model defines a trainable `nn.Embedding(4, d_model)` representing these types.
* The output vector of the temporal encoder is summed directly with the node type embedding:
  $$\mathbf{h}_i = \mathbf{h}_{\text{temp}, i} + \mathbf{h}_{\text{type}, i}$$

#### Step 3: Spatial Graph Transformer (Spatial Message Passing)
The combined embeddings are passed into two layers of **`TransformerConv`** (from PyTorch Geometric).
* **How it works**: Unlike standard Graph Convolutional Networks (GCNs) which weigh neighbor messages statically, `TransformerConv` computes dynamic attention weights between connected nodes:
  $$\alpha_{ij} = \text{Softmax}_j \left( \frac{(\mathbf{W}_q \mathbf{h}_i)^T (\mathbf{W}_k \mathbf{h}_j)}{\sqrt{d}} \right)$$
* This allows store nodes to attend more to a bottleneck distributor node during periods of low supply.
* **Non-linearity**: ELU activation and dropout (0.3) are applied between layers to stabilize gradient propagation.

#### Step 4: Prediction Output
A final fully connected linear layer projects the spatial representations down to a single forecasting value representing the predicted demand for the next time step.

```python
# Core model forward pass in stgt.py
def forward(self, x, edge_index, node_types):
    # x shape: [num_nodes, max_timesteps, 1]
    
    # 1. Capture temporal dependencies
    h_temp = self.temporal_encoder(x)  # [num_nodes, d_model]
    
    # 2. Add spatial node type embeddings
    h_types = self.type_embedding(node_types)  # [num_nodes, d_model]
    h = h_temp + h_types
    
    # 3. Perform Graph Transformer message passing
    h = self.conv1(h, edge_index)
    h = F.elu(h)
    h = F.dropout(h, p=self.dropout, training=self.training)
    
    h = self.conv2(h, edge_index)
    h = F.elu(h)
    h = F.dropout(h, p=self.dropout, training=self.training)
    
    # 4. Final linear prediction
    out = self.fc(h)  # [num_nodes, 1]
    return out
```

---

## 🤖 4. Autonomous Multi-Agent Procurement Engine

SupplyGraph deploys a sequential multi-agent loop to automate inventory auditing and vendor negotiations:

```
[Inventory CSV Snapshot] 
        │
        ▼
[Procurement Auditor Agent (A)]
        │ 
        ├─► Calculates Deficits (ROP + Safety Stock - Stock)
        ▼
[Procurement Brief] 
        │
        ▼
[Vendor Negotiator Agent (B)]
        ├─► Adjusts to MOQ (Minimum Order Quantity)
        ├─► 25% Threshold Auto-Bump (Volume Discount Bracket)
        ├─► Simulates Email Negotiation Dialogue (Gemini 1.5 Flash)
        ▼
[Optimized Ordering Proposals]
```

### Agent A: The Procurement Auditor Agent
* **Role**: Audits inventory snapshot tables containing current stock, lead times, safety stocks, and forecasted demand.
* **Heuristics**: Filters out products classified as `critical` or `reorder_needed`.
* **Formula**: Computes the required replenishment deficit using the formula:
  $$\text{Deficit} = \max(50, (\text{Reorder Point} + \text{Safety Stock}) - \text{Current Stock})$$
* **LLM Enrichment**: If configured, uses `gemini-1.5-flash` to read the raw deficit outputs and generate a concise 3-sentence executive summary highlighting the business urgency.

### Agent B: The Vendor Negotiator Agent
* **Role**: Matches the Auditor's Procurement Brief against a database of supplier terms (Base costs, Minimum Order Quantity (MOQ), volume discount thresholds).
* **MOQ Rule**: Ensures the proposed quantity is at least the supplier's MOQ. If lower, it bumps the order quantity up to meet the requirement:
  $$\text{Quantity}_{\text{MOQ}} = \max(\text{Deficit}, \text{MOQ})$$
* **25% Discount Threshold Auto-Bumping**: If the current order quantity is within 25% of the supplier's next volume discount threshold, it automatically bumps the order quantity to that threshold:
  $$\text{if } (\text{Threshold} - \text{Qty}) \le 0.25 \times \text{Threshold} \implies \text{Qty} = \text{Threshold}$$
* **Negotiation Transcript**: Uses `gemini-1.5-flash` to compose a realistic, formal 2-way email exchange between the Buyer Agent and the Supplier Sales Representative, confirming the volume discount application and final adjusted unit cost.

---

## ☁️ 5. DevOps, Scaling & Production Architecture

### Database Choice: DynamoDB Single-Table Design
Instead of using a relational database with multiple joins, we use a single DynamoDB table (`SupplyGraph-Prod`).
* **Why?**: To achieve single-digit millisecond response times and serverless scale.
* **Key Structure**:
  * Invite tokens: `PK = INVITE#<token>`, `SK = METADATA`
  * Model metadata: `PK = COMPANY#<companyId>`, `SK = MODEL`
  * Training Status: `PK = COMPANY#<companyId>`, `SK = TRAINING_STATUS`
  * Company users: `PK = COMPANY#<companyId>`, `SK = USER#<userId>`

### CI/CD Workflow with AWS OIDC Federation
* **Security**: No long-term AWS access keys are stored in GitHub Secrets.
* **Authentication**: GitHub Actions uses OpenID Connect (OIDC) to assume a temporary AWS IAM Role using JWT token exchange.
* **Frontend Pipeline**: Compiles React files, syncs them to S3, and triggers a CloudFront cache invalidation (`aws cloudfront create-invalidation`).
* **Backend Pipeline**: Builds Docker containers for Node.js and Flask, pushes them to Amazon ECR, logs in via SSH to an EC2 instance, downloads decryted credentials from **AWS SSM Parameter Store**, pulls ECR containers, and restarts them gracefully.

---

## 💬 6. Scenario-Based Questions & Answers for the Interview

### Q1: "Why did you build a custom Spatio-Temporal Graph Transformer rather than using standard ARIMA or Prophet?"
> **Answer**: "Standard time-series models like ARIMA, Prophet, or even standard LSTMs assume that each node's demand is independent of the rest of the network. In a real-world supply chain, if a central warehouse experiences a stock shortage, it immediately impacts the stores it services. 
> By representing the supply chain as a Spatio-Temporal Graph, we encode both spatial relationships (edges) and temporal demand trends (sliding history windows). The `TransformerConv` layers perform message passing over these edges, allowing the model to learn that a drop in supply or an anomaly at a warehouse will ripple to linked retail outlets."

### Q2: "How does the model handle 'Data Leakage' during training and scaling?"
> **Answer**: "Data leakage is a common trap in time-series forecasting, especially when scaling features. We prevented this in two ways:
> 1. **Temporal Splits**: We split the dataset chronologically (70% train, 20% validation, 10% test) rather than using a random train-test split. This ensures the model never evaluates on past information that was leaked from the future.
> 2. **Localized Scalers**: The `StandardScaler` for each node is fit **only** on the training portion of that node's time series. The validation and test datasets are scaled using the mean and variance computed from the training split, preventing forward-looking scale leakage."

### Q3: "What happens if a worker container crashes during an ML training run? How is the queue designed to be resilient?"
> **Answer**: "We offloaded ML training using **AWS SQS** as an asynchronous queue. We set the **SQS Visibility Timeout** to **900 seconds (15 minutes)**. 
> When the ML worker pulls a training message, SQS makes that message invisible to other workers. If the container crashes mid-training, it fails to delete the message. After 15 minutes, SQS automatically makes the message visible again, allowing a healthy or newly launched worker to pick it up and restart training. If a message fails repeatedly, it is routed to a Dead-Letter Queue (DLQ) for alerting and debugging."

### Q4: "How would you scale this single-server EC2 setup to handle millions of transactions and users?"
> **Answer**: "I would migrate the system from a single EC2 host to a fully decoupled, stateless, and horizontally auto-scaled architecture:
> 1. **Session Decoupling**: Currently, Express stores session tokens. I would deploy an **Amazon ElastiCache for Redis** cluster and use it as a shared session store, making the Node.js API servers completely stateless.
> 2. **Decouple API and ML**: I would separate the Node API and Python ML engine into distinct Auto Scaling Groups (ASGs). The Node API ASG would scale based on target CPU utilization (e.g., 60%), while the ML workers would run as independent containers (e.g., on AWS ECS Fargate) reading from the SQS queue.
> 3. **Application Load Balancer**: I would place the stateless Node servers behind an ALB, using path-based routing (`/api/*` targets the API group) and health checks (hitting `/api/ml/health`).
> 5. **Database Scaling**: DynamoDB is serverless; I would switch it from provisioned capacity to **On-Demand Capacity Mode** and introduce **DAX (DynamoDB Accelerator)** as a microsecond read-cache in front of it."

### Q5: "When force-retraining, you re-initialize the output head's linear layer weights. Why is this necessary?"
> **Answer**: "During fine-tuning, the model starts from the pre-trained weights. However, if the new tenant's data distribution is significantly different from the base dataset, a fully trained output head might carry over stale biases that cause gradient explosions, resulting in predictions with values over 100k+ on small targets. 
> To prevent this, when a force-retrain is triggered, we re-initialize the weights of the final linear layer (`model.fc`) using Xavier Uniform initialization and reset the biases to zero. This forces the model to learn the linear scaling of the new tenant's data from scratch while retaining the spatial and temporal feature extractors."

### Q6: "Why is the scale-out cooldown period important, and how would you configure it?"
> **Answer**: "The scale-out cooldown is a lock-out period (e.g., 300 seconds) during which the Auto Scaling Group cannot launch additional instances. When CPU utilization spikes and triggers a scaling action, it takes time (2–4 minutes) for a new EC2 instance to boot, pull Docker images, and become healthy in the ALB target group. 
> Without a cooldown period, the CPU utilization metric would remain high during this boot time, triggering repeated, unnecessary scaling alarms. This results in 'thrashing' (launching far too many servers). I would set the scale-out cooldown to 300 seconds to give the new instance sufficient time to start handling traffic."

---

## 🛠️ 7. File Mapping Cheat Sheet for Interviews

Use these links to direct an interviewer to the exact files where these systems are implemented:

* **Neural Network Structure**: [stgt.py](file:///c:/PROJECTS/SupplyChain/GNN_SupplyChainForecasting/SupplyGraph/Backend/ml-service/models/stgt.py) — Defines the Spatial-Temporal Graph Transformer architecture.
* **ML Trainer Orchestration**: [trainer.py](file:///c:/PROJECTS/SupplyChain/GNN_SupplyChainForecasting/SupplyGraph/Backend/ml-service/training/trainer.py) — Coordinates file validation, temporal splits, training loops, early stopping, and AWS S3 weight serialization.
* **Multi-Agent Engine**: [agents.py](file:///c:/PROJECTS/SupplyChain/GNN_SupplyChainForecasting/SupplyGraph/Backend/ml-service/prediction/agents.py) — Implements `ProcurementAuditorAgent` and `VendorNegotiatorAgent` along with Gemini LLM enrichment.
* **Cloud Infrastructure Specs**: [DEPLOYMENT_GUIDE.md](file:///c:/PROJECTS/SupplyChain/GNN_SupplyChainForecasting/DEPLOYMENT_GUIDE.md) — Exhaustive guide on cloud topologies, zero-downtime strategies, and deployment scripts.
