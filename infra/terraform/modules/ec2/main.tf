variable "app_name" {
  type = string
}

variable "ec2_role_name" {
  type = string
}

variable "key_pair_name" {
  type = string
}

variable "your_ip_cidr" {
  type = string
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

resource "aws_security_group" "ec2" {
  name        = "${var.app_name}-ec2-sg"
  description = "SupplyGraph EC2 security group"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.your_ip_cidr] # SSH access
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # HTTP web traffic
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # HTTPS traffic
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"] # Internet access for packages / S3 / SQS
  }
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t3.small" # 2GB RAM
  key_name               = var.key_pair_name
  iam_instance_profile   = var.ec2_role_name
  vpc_security_group_ids = [aws_security_group.ec2.id]

  root_block_device {
    volume_size = 20 # 20GB storage for Docker images + packages
    volume_type = "gp3"
  }

  # Bootstrap script runs once on first launch
  user_data = base64encode(file("${path.module}/userdata.sh"))

  tags = {
    Name        = "${var.app_name}-app"
    Environment = "production"
  }
}

output "public_ip" {
  value = aws_instance.app.public_ip
}

output "public_dns" {
  value = aws_instance.app.public_dns
}

output "instance_id" {
  value = aws_instance.app.id
}
