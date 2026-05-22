variable "aws_region" {
  description = "AWS region to deploy resources in"
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Application name prefix for all resources"
  type        = string
  default     = "supplygraph"
}

variable "github_org" {
  description = "GitHub username or organization name"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "GNN_SupplyChainForecasting"
}

variable "ec2_key_pair_name" {
  description = "Name of the EC2 key pair for SSH access"
  type        = string
}

variable "your_ip_cidr" {
  description = "Your IP address CIDR block for secure SSH access (e.g., 203.0.113.5/32)"
  type        = string
}
