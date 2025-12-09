FROM python:3.10-slim AS base
ARG NODE_VERSION=18

# System deps: Node + Supervisor + build tools for Python wheels
RUN apt-get update && \
    apt-get install -y curl gnupg build-essential supervisor && \
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/* && \
    pip install --no-cache-dir --upgrade pip

WORKDIR /app

# Install backend Node deps
COPY Backend/package*.json Backend/
RUN cd Backend && npm install --production

# Install ML Python deps
COPY Backend/ml-service/requirements.txt Backend/ml-service/requirements.txt
RUN pip install --no-cache-dir -r Backend/ml-service/requirements.txt

# Copy backend source (Node + ML)
COPY Backend Backend

WORKDIR /app/Backend

# Ports: Render sets $PORT for Node. ML binds to 5001 internally.
ENV PORT=10000
ENV ML_PORT=5001

EXPOSE 10000

# Supervisor config to run both ML (5001) and Node ($PORT)
COPY supervisor.conf /etc/supervisor/conf.d/supervisor.conf

# Run supervisor in the foreground (Render expects one foreground process)
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisor.conf", "-n"]

