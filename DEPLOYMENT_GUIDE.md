# SupplyGraph: Production Cloud Deployment & Scaling Guide

This guide provides a comprehensive breakdown of the production deployment architecture for the **SupplyGraph GNN-Based Supply Chain Forecasting** application. It details **how** the system is deployed, **why** these services were selected, and **how to design, scale, and automate** this system for high availability in a DevOps production setting.

---

## 🏗️ 1. Current Infrastructure Architecture

SupplyGraph is deployed on **Amazon Web Services (AWS)** using a decoupled frontend/backend topology. Infrastructure is provisioned via **Terraform** to ensure Infrastructure as Code (IaC) consistency.

### System Topology Diagram

```
                       ┌─────────────────────────┐
                       │       DNS / Client      │
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

### Component Details
1. **Frontend Hosting**: React SPA static files are hosted in a secure, private **Amazon S3** bucket. 
2. **Content Delivery Network (CDN)**: **Amazon CloudFront** acts as the global edge router. It caches frontend assets globally and forwards API routes (`/api/*`) securely to the EC2 backend.
3. **Backend Host**: An **Amazon EC2 (t3.small)** instance runs Docker Compose, housing:
   - **Nginx Reverse Proxy**: Receives HTTP traffic on port 80 and routes `/api/*` queries to port 5000.
   - **Node.js Express App**: Handles business logic, authentication, uploads, and dispatches heavy operations.
   - **Flask ML Service**: Manages GAT+LSTM configurations, prediction caching, and GNN retraining steps.
4. **Asynchronous Queues**: **Amazon SQS** queues long-running ML jobs to protect backend processes from timeouts.
5. **Database**: **Amazon DynamoDB** serves as the central serverless database using a single-table design (`SupplyGraph-Prod`). Large ML model weights are stored in **Amazon S3** under the models folder.
6. **Log Audits**: Docker streams container output directly to **AWS CloudWatch** via the native `awslogs` driver.

---

## ⚙️ 2. Step-by-Step Deployment Mechanics

Our automated pipeline deploys modifications to production using **GitHub Actions CI/CD** with **AWS IAM OIDC** identity federation, completely bypassing long-lived access keys.

### A. Frontend Deployment Workflow (`.github/workflows/deploy-frontend.yml`)
1. **Authentication**: Requests temporary AWS credentials via OpenID Connect (OIDC) using the role ARN: `${{ secrets.AWS_ROLE_ARN }}`.
2. **Build**: Compiles the React application into static assets (`npm run build`).
3. **Sync**: Uploads the `./build` folder directly to the S3 bucket:
   ```bash
   aws s3 sync ./build/ s3://supplygraph-frontend-bucket --delete
   ```
4. **Cache Invalidation**: Flushes CloudFront CDN caches globally so clients retrieve new bundle hashes instantly:
   ```bash
   aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
   ```

### B. Backend & ML Deployment Workflow (`.github/workflows/deploy-backend.yml`)
1. **Docker Build & Registry Push**: Builds distinct Docker images for the Node.js API and Python Flask service. Logs into **Amazon Elastic Container Registry (ECR)** and pushes the images:
   ```bash
   docker build -t $REGISTRY/supplygraph/backend:latest ./SupplyGraph/Backend
   docker push $REGISTRY/supplygraph/backend:latest
   ```
2. **Server Handshake**: Uses secure SSH keys (`appleboy/ssh-action`) to command the EC2 container runtime.
3. **Runtime Configuration Sync**: Downloads configuration secrets from **AWS SSM Parameter Store** dynamically, injecting them directly into the local environment file (`.env`) at startup:
   ```bash
   aws ssm get-parameters-by-path --path "/supplygraph/prod/" --with-decryption ... > .env
   ```
4. **Orchestrator Boot**: Logs into ECR from the server, pulls the freshly built images, and performs a graceful rolling container restart:
   ```bash
   docker compose pull
   # Up with removal of orphaned dependencies
   docker compose up -d --remove-orphans
   ```
5. **Reverse Proxy Load**: Overwrites Nginx configs and reloads the daemon:
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/default
   sudo systemctl reload nginx
   ```

---

## 🎯 3. Architectural Design Decisions ("Why This, Not That?")

For a DevOps interview, you must justify *why* you chose specific technologies over standard alternatives.

| Chosen Service | Alternative Considered | Trade-off / Architectural Rationale |
| :--- | :--- | :--- |
| **S3 + CloudFront CDN** | Hosting frontend on EC2 (Nginx) | **Decoupling, Performance, and Security.** Serving files from EC2 wastes CPU, RAM, and bandwidth. Placing them on S3 + CloudFront ensures <10ms edge caching globally, 99.999% availability, and automatic HTTPS termination. Crucially, the EC2 instance is protected: no direct internet traffic reaches EC2 port 80; CloudFront serves as the single ingress point. |
| **EC2 + Docker Compose** | AWS ECS (Fargate) or Kubernetes (EKS) | **Cost Control & Pragmatic Simplicity.** In early stages, ECS Fargate requires NAT Gateways, Application Load Balancers (ALBs), and container storage, running a base cost of $50–$100/month. An EC2 `t3.small` runs for ~$15/month. Docker Compose packages all services cleanly, allowing us to migrate to ECS/EKS with minimal config changes later. |
| **AWS SQS (Simple Queue Queue)** | In-Memory Queue (e.g. BullMQ / Redis) | **Durability & Decoupling.** GNN retraining runs are intensive and can take up to 15 minutes. An in-memory queue crashes if the Node container restarts. SQS is a serverless, highly durable queue with a 15-minute visibility timeout. If a worker goes offline mid-train, the message is returned to the queue or sent to a Dead-Letter Queue (DLQ) for analysis. |
| **SSM Parameter Store** | Git-committed `.env` files | **Security.** Never commit secrets to source control. SSM Parameter Store encrypts configurations at rest (using KMS) and supports granular IAM access. GitHub Actions and EC2 retrieve credentials dynamically on demand. |

---

## 📈 4. The Scaling Posture (Why we aren't auto-scaling, and what we should do)

### Our Current Scalability Limits
Currently, the system is **not** auto-scaled. It is a single-server deployment (`t3.small` EC2 instance). 
* **The "Single Point of Failure" (SPOF)**: If the EC2 host goes offline, both the API and ML services crash.
* **Vertical Bounds**: To handle more load, we must manually change the instance type (e.g., from `t3.small` to `t3.medium`). This requires server downtime.
* **CPU Contention**: The Node API and Flask ML processes compete for the same 2 vCPUs. Heavy training tasks will saturate the CPU, causing API requests to time out.

---

## 🚀 5. DevOps Interview Mastery: Scaling the System to Millions of Users

In a DevOps interview, if you are asked **"How would you scale this system horizontally?"**, use the following structure.

### Step 1: Stateless Migration (Session Decoupling)
Currently, our Node.js server uses local memory or cookie storage for session state. If we add multiple backend instances, requests will route to different servers, losing user sessions.
* **The Solution**: Deploy **Amazon ElastiCache for Redis**. Modify the Node Express session store to target Redis. This makes our backend instances fully **stateless**; any server can handle any request at any time.

### Step 2: Separate the API from the ML Engine
Never run light API endpoints on the same instances as heavy GPU/CPU machine learning tasks.
* **The Solution**: 
  - Create one Auto Scaling Group (ASG) for the Node.js **API Backend**.
  - Create a separate worker cluster (e.g., using **AWS ECS Fargate** or specialized GPU instances) for the **ML Training Engine**.
  - SQS acts as the asynchronous bridge. The API places jobs on SQS; the detached ML workers pick them up, execute training, upload models to S3, and update the status in DynamoDB.

### Step 3: Set up an Application Load Balancer (ALB) and Auto Scaling Group (ASG)
To run multiple servers, we need an ALB to distribute traffic and an ASG to add/remove instances automatically.

```
                  ┌───────────────────────────────┐
                  │      AWS CloudFront CDN       │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                ┌───────────────────────────────────┐
                │   Application Load Balancer (ALB) │
                └───────┬───────────────┬───────────┘
                        │               │
            (Route 1)   │               │   (Route 2)
                        ▼               ▼
             ┌──────────────┐       ┌──────────────┐
             │ Node API #1  │       │ Node API #2  │
             └──────────────┘       └──────────────┘
             [ ─── AWS Auto Scaling Group (ASG) ─── ]
```

#### What is an ALB and how does it route traffic?
An **Application Load Balancer (ALB)** operates at **Layer 7** (Application layer) of the OSI model.
* **Routing**: It routes traffic based on HTTP headers, cookies, or URL paths (e.g., path `/api/*` goes to the API Target Group).
* **Health Checks**: The ALB continuously sends HTTP requests to a target path (e.g., `GET /api/ml/health`) on each instance. If an instance fails 3 consecutive checks, the ALB stops routing traffic to it.
* **Distribution Algorithm**: It uses algorithms like **Round Robin** (cycling through hosts) or **Least Outstanding Requests** (sending traffic to the least busy server).

---

## ⏱️ 6. How Auto-Scaling Works Automatically (Thresholds & Mechanics)

Auto-scaling is not instantaneous. It depends on a chain of events triggered by CloudWatch alarms.

### A. The Auto-Scaling Loop
```
[Metrics collected] ──> [CloudWatch Alarm] ──> [ASG Scaling Policy] ──> [EC2 Instance Boot] ──> [ALB Health Check] ──> [Receive Traffic]
```

### B. Defining the Thresholds
To prevent servers from crashing under sudden load spike, we define scaling policies. In production, we use two types of policies:

#### 1. Target Tracking Scaling Policy (Set and Forget)
You tell AWS: *"Keep the average CPU utilization at 60%."* AWS automatically calculates when to add or remove servers.
* **Why 60% and not 90%?** Booting a new EC2 instance, installing Docker, pulling the registry images, and initializing the application takes time (often 2–4 minutes). If you wait until CPU hits 90%, the existing servers will crash before the new ones can boot.

#### 2. Step Scaling Policy (Metric-Based Actions)
For precise control, we link policies to CloudWatch Alarms:
* **Scale-Out Alarm (Add Servers)**:
  * **Metric**: `CPUUtilization` > 70% for 3 consecutive evaluation periods of 60 seconds (total 3 minutes).
  * **Action**: Launch +1 instance.
* **Scale-In Alarm (Remove Servers)**:
  * **Metric**: `CPUUtilization` < 30% for 5 consecutive evaluation periods of 60 seconds (total 5 minutes).
  * **Action**: Terminate -1 instance.

### C. Critical Auto-Scaling Concepts for Interviews

#### 1. Scale-Out Cooldown vs. Scale-In Cooldown
* **What is it?** A lock-out period (typically 300 seconds) after a scaling action during which no other scaling actions can be triggered.
* **Why do we need it?** If CPU spikes to 85% and triggers a new instance boot, it takes time for that instance to start. Without a cooldown, the CPU metric will remain high during the boot phase, triggering *another* server launch. This results in launching too many servers ("thrashing").

#### 2. Instance Warm-up Time
* **What is it?** The time allocated for a new instance to run its bootstrap script (`userdata.sh`), launch Docker containers, and pass the ALB health check.
* **Interview Point**: Traffic is only routed to the instance once the target state changes from `Initial` to `Healthy` in the ALB Target Group.

#### 3. Database Scaling
You cannot scale a traditional database by simply adding new servers in an Auto Scaling Group, because databases have state (data storage).
* **The Solution**: 
  - **Read/Write Scaling**: Enable **DynamoDB Auto-Scaling** (for provisioned mode) or configure **On-Demand Capacity Mode** which handles up to double the previous peak load instantly.
  - **Microsecond Read Latency Caching**: Deploy **Amazon DynamoDB Accelerator (DAX)** in front of the table to cache hot keys and reduce read loads from milliseconds to microseconds.
  - **Global Distribution**: Utilize **DynamoDB Global Tables** to replicate data across multiple AWS regions with active-active scaling.

---

## 🎯 7. Zero-Downtime Deployment Strategies with ALB

If you push a new backend update, how do you prevent users from seeing errors?

### Option A: Rolling Updates (Default)
The ASG launches a new instance running the updated code. Once the new instance passes the ALB health check, the ALB routes traffic to it, and gracefully terminates one old instance. This repeats until all instances are updated.
* **Pros**: Simple, uses existing resources.
* **Cons**: During deployment, two different versions of the API run simultaneously (a "Canary" or mixed state).

### Option B: Blue/Green Deployments (High Reliability)
You spin up a completely duplicate environment (**Green**) running the new version alongside the current production environment (**Blue**).
* **Testing**: You run integration tests on the Green environment privately.
* **Switchover**: You update the DNS record or swap the ALB target group routing from Blue to Green. Traffic switches over instantly.
* **Rollback**: If tests fail on Green post-launch, you immediately route traffic back to Blue.
* **Pros**: Zero-downtime, safe, instant rollback.
* **Cons**: Double the server costs during the transition phase.

---

## 📋 8. Key DevOps Interview Cheat Sheet

Be prepared to answer these questions using the concepts from this guide:

**Q: How do you handle secrets securely in your CI/CD pipeline?**
* **A**: I use GitHub Actions OIDC integration with AWS, assuming an IAM role to avoid using hardcoded long-term Access Keys. Secrets are stored in AWS SSM Parameter Store with KMS encryption, and retrieved dynamically on the server during the container startup phase.

**Q: What is the difference between scaling a stateless service vs. a stateful service?**
* **A**: Stateless services (like our Node API) do not store data locally. We can scale them horizontally inside an Auto Scaling Group behind an ALB instantly. Stateful services (like DynamoDB or Redis sessions) hold memory and data. They require managed configurations (like DynamoDB on-demand scaling or DAX caching) and session store clustering to scale.

**Q: SQS visibility timeout is set to 900 seconds (15 minutes). Why?**
* **A**: GNN model training can take up to 10–12 minutes. If the SQS visibility timeout was set to the default 30 seconds, another worker would assume the active training job had failed, pulling the message and starting a duplicate training task. Setting it to 15 minutes ensures the processing worker has sufficient time to complete training and delete the message from the queue.
