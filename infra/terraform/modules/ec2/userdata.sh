#!/bin/bash
set -e

# Update apt package database
apt-get update -y

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu
systemctl enable docker

# Install Docker Compose plugin, AWS CLI, Nginx, and wget
apt-get install -y docker-compose-plugin awscli nginx wget

# Install CloudWatch Agent
wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i amazon-cloudwatch-agent.deb

# Set up application workspace
mkdir -p /home/ubuntu/supplygraph
chown ubuntu:ubuntu /home/ubuntu/supplygraph

echo "Bootstrap complete" >> /var/log/supplygraph-bootstrap.log
