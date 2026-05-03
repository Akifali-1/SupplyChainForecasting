# SupplyGraph Architecture & Technical Overview

This document provides a detailed breakdown of the SupplyGraph system, explaining the underlying technologies, system architecture, and the lifecycle of the Machine Learning models used for supply chain forecasting.

## 1. Project Overview

SupplyGraph is an AI-powered supply chain optimization and demand forecasting platform. Traditional forecasting models (like ARIMA or simple linear regression) treat every store or product in isolation. SupplyGraph uses **Graph Neural Networks (GNNs)** to understand the physical and logistical relationships in a supply chain (e.g., if a regional distribution plant is delayed, how does it affect the stores it supplies?).

## 2. Technology Stack

SupplyGraph operates on a modern, decoupled microservices architecture:

### Frontend (User Interface)
*   **React.js**: Core UI framework.
*   **Tailwind CSS**: Utility-first CSS framework for rapid, responsive, and highly aesthetic styling.
*   **Lucide React**: Iconography.
*   **Context API / LocalStorage**: For session management and company state persistence.

### Main Backend (Gateway & Orchestrator)
*   **Node.js & Express**: Acts as the API Gateway.
*   **MongoDB & Mongoose**: Stores user accounts, authentication data, and company metadata.
*   **Multer**: Handles parsing and storing large CSV file uploads.
*   **Role**: Handles user authentication (Google OAuth/JWT), file processing, idempotency (preventing duplicate requests), and proxies heavy analytical requests to the Python ML Service.

### ML Service (Artificial Intelligence Engine)
*   **Python & Flask**: A dedicated microservice specifically for heavy computations.
*   **PyTorch**: The core deep learning framework used to build and train the neural networks.
*   **PyTorch Geometric (PyG)**: A specialized library for Deep Learning on Graphs.
*   **Pandas & NumPy**: For massive dataset manipulation, sliding-window transformations, and statistical calculations.

---

## 3. The Machine Learning Architecture

The brain of SupplyGraph is a Hybrid **GAT-LSTM** neural network. 

1.  **GAT (Graph Attention Network)**: Reads the `nodes.csv` and `edges.csv` to build a mathematical map of the supply chain. It uses "attention mechanisms" to learn which connections are most important (e.g., a massive Plant has a higher "attention" weight than a small local store).
2.  **LSTM (Long Short-Term Memory)**: A type of Recurrent Neural Network (RNN) that excels at reading time-series data. It looks at the past 30 days of `Sales Order.csv` to predict the future.

By combining them, the model learns both **Space** (where things are in the supply chain) and **Time** (when things are sold).

---

## 4. How the Model is Trained (Base Training)

1.  **Data Preparation**: The system takes raw sales data and converts it into "Sliding Windows". If the window size is 5, it uses Days 1-5 to predict Day 6. Then Days 2-6 to predict Day 7, etc.
2.  **Scaling**: Data is normalized using `StandardScaler` to ensure the neural network isn't confused by vastly different sales volumes (e.g., Store A sells 10,000 units, Store B sells 10 units).
3.  **Epochs & Loss**: The model makes predictions, compares them to the actual historical answers, and calculates the error using **Huber Loss** (which is resistant to crazy outliers like Black Friday sales spikes).
4.  **Backpropagation**: The model adjusts its internal mathematical weights to make the error smaller in the next epoch.

---

## 5. Model Storage and Retrieval

Models are not stored in the database. Neural network weights are massive matrices of floating-point numbers.

*   **Storage**: 
    *   The trained neural network weights are saved to the server's hard drive as `.pth` (PyTorch State Dictionary) files.
    *   The data scalers are saved as `.pkl` (Pickle) files.
    *   The state of the training (current epoch, MAPE score, loss) is saved in a `meta.json` file.
*   **Directory Structure**: Models are saved in `Backend/ml-service/models/<company_id>/`.
*   **Retrieval**: When a user goes to the Dashboard, the Python Flask API intercepts the request, loads the specific `.pth` file for that user's `company_id` into memory (RAM), and runs a "Forward Pass" to instantly generate new predictions.

---

## 6. How Fine-Tuning Works

When a new user uploads their own company's CSV files, the system doesn't start from scratch, nor does it use a generic model. It uses **Fine-Tuning (Transfer Learning)**.

1.  **Initialization**: The system loads the "Base Model" which already understands general concepts of supply and demand.
2.  **Architecture Adaptation**: Because the new user has a different number of stores and plants, the system dynamically resizes the final output layers of the neural network to match the user's specific supply chain size.
3.  **Targeted Training**: The system trains the model specifically on the user's uploaded data. It heavily updates the newly resized output layers, while making smaller adjustments to the deep "knowledge" layers.
4.  **Early Stopping**: The system monitors the Validation Loss. If the model stops improving for 20 epochs (the `patience` parameter), it stops training early to prevent "overfitting" (memorizing the data instead of learning patterns).
5.  **Saving**: The newly customized model is saved under the user's specific `company_id` folder, ready for the prediction dashboard.
