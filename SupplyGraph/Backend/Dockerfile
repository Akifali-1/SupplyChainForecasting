FROM python:3.10-slim AS base
ARG NODE_VERSION=18

# System deps: Node + Supervisor + build tools for Python wheels
RUN apt-get update && \
    apt-get install -y curl gnupg build-essential supervisor && \
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/* && \
    pip install --no-cache-dir --upgrade pip

# All files are inside Backend because of Root Directory in Render
WORKDIR /app

# Install Node backend dependencies
COPY package*.json ./
RUN npm install --production

# Install ML Python dependencies
COPY ml-service/requirements.txt ml-service/requirements.txt
RUN pip install --no-cache-dir -r ml-service/requirements.txt

# Copy the backend source code (Node + ML + uploads)
COPY . .

# Environment ports
ENV PORT=10000
ENV ML_PORT=5001

EXPOSE 10000

# Add supervisor config
COPY supervisor.conf /etc/supervisor/conf.d/supervisor.conf

# Start supervisor (keeps both Node + Flask running)
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisor.conf", "-n"]
