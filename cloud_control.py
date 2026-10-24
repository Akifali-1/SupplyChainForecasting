#!/usr/bin/env python3
"""
SupplyGraph (SupplyChain) AWS Cost & Deployment Controller
==========================================================
Usage:
    python cloud_control.py status   # Check EC2 status and estimated hourly costs
    python cloud_control.py stop     # Stop EC2 instance to halt compute charges ($0.00/hr)
    python cloud_control.py start    # Start EC2 instance & re-sync CloudFront origin (~30s)
"""

import os
import sys
import time
import subprocess
import json
from pathlib import Path

# Fix Windows console encoding
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

REPO_ROOT = Path(__file__).resolve().parent
ENV_FILE = REPO_ROOT / "SupplyGraph" / "Backend" / ".env"
EC2_INSTANCE_ID = "i-0660c1362f023b934"
CLOUDFRONT_DISTRIBUTION_ID = "E50OVT4M1ASYJ"
CLOUDFRONT_URL = "https://d2r7skqvt7wngo.cloudfront.net"

def load_credentials():
    """Load AWS credentials from .env or environment."""
    env = os.environ.copy()
    if ENV_FILE.exists():
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k not in env:
                        env[k] = v
    env["AWS_DEFAULT_REGION"] = env.get("AWS_REGION", "us-east-1")
    return env

def get_ec2_info(env):
    """Retrieve current EC2 instance state and public DNS."""
    try:
        import boto3
        ec2 = boto3.client(
            "ec2",
            aws_access_key_id=env.get("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=env.get("AWS_SECRET_ACCESS_KEY"),
            region_name=env.get("AWS_DEFAULT_REGION", "us-east-1")
        )
        res = ec2.describe_instances(InstanceIds=[EC2_INSTANCE_ID])
        inst = res["Reservations"][0]["Instances"][0]
        state = inst["State"]["Name"]
        public_ip = inst.get("PublicIpAddress", "N/A")
        public_dns = inst.get("PublicDnsName", "N/A")
        return state, public_ip, public_dns
    except Exception as e:
        return "unknown", str(e), "N/A"

def get_status():
    """Display live deployment state and cost estimate."""
    print("==================================================")
    print("  SupplyGraph Cloud Deployment Status")
    print("==================================================")
    env = load_credentials()
    state, ip, dns = get_ec2_info(env)
    
    print(f"EC2 Instance ID:       {EC2_INSTANCE_ID}")
    print(f"Current State:         [{state.upper()}]")
    print(f"Public IP:             {ip}")
    print(f"Public DNS:            {dns}")
    print(f"CloudFront URL:        {CLOUDFRONT_URL}")
    
    if state == "running":
        print(f"Estimated Cost:        ~$0.02/hour (~$15/mo) while running")
        # Check live health
        try:
            import urllib.request
            req = urllib.request.Request(f"{CLOUDFRONT_URL}/api/health", headers={"User-Agent": "cloud-control"})
            with urllib.request.urlopen(req, timeout=5) as r:
                if r.status == 200:
                    print(f"Live Health Check:     [OK] - API responds 200 Healthy!")
                else:
                    print(f"Live Health Check:     [STATUS {r.status}]")
        except Exception:
            print(f"Live Health Check:     [CONNECTING / WARMING UP]")
    else:
        print(f"Estimated Cost:        $0.00/hour (EC2 compute charges stopped!)")
    print("==================================================")

def stop_instance():
    """Stop EC2 instance to halt hourly compute charges."""
    print(f"[*] Stopping SupplyGraph EC2 instance ({EC2_INSTANCE_ID}) to save AWS credits...")
    env = load_credentials()
    try:
        import boto3
        ec2 = boto3.client(
            "ec2",
            aws_access_key_id=env.get("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=env.get("AWS_SECRET_ACCESS_KEY"),
            region_name=env.get("AWS_DEFAULT_REGION", "us-east-1")
        )
        ec2.stop_instances(InstanceIds=[EC2_INSTANCE_ID])
        print("    Waiting for instance to power off cleanly...")
        waiter = ec2.get_waiter("instance_stopped")
        waiter.wait(InstanceIds=[EC2_INSTANCE_ID])
        print("\n[OK] SupplyGraph EC2 instance is now STOPPED!")
        print("     Ongoing compute costs are now $0.00/hour.")
        print(f"     Static frontend remains cached at {CLOUDFRONT_URL}.")
    except Exception as e:
        print(f"[!] Error stopping instance: {e}")

def start_instance():
    """Start EC2 instance and re-sync CloudFront origin with any new public IP."""
    print(f"[*] Starting SupplyGraph EC2 instance ({EC2_INSTANCE_ID}) for interview/demo...")
    env = load_credentials()
    try:
        import boto3
        ec2 = boto3.client(
            "ec2",
            aws_access_key_id=env.get("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=env.get("AWS_SECRET_ACCESS_KEY"),
            region_name=env.get("AWS_DEFAULT_REGION", "us-east-1")
        )
        cf = boto3.client(
            "cloudfront",
            aws_access_key_id=env.get("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=env.get("AWS_SECRET_ACCESS_KEY"),
            region_name=env.get("AWS_DEFAULT_REGION", "us-east-1")
        )
        
        ec2.start_instances(InstanceIds=[EC2_INSTANCE_ID])
        print("    Waiting for instance to boot...")
        waiter = ec2.get_waiter("instance_running")
        waiter.wait(InstanceIds=[EC2_INSTANCE_ID])
        
        state, ip, new_dns = get_ec2_info(env)
        print(f"[OK] Instance running with Public IP: {ip} ({new_dns})")
        
        # Check CloudFront origin and update if DNS changed
        print("[*] Checking CloudFront origin routing...")
        cf_config = cf.get_distribution_config(Id=CLOUDFRONT_DISTRIBUTION_ID)
        config = cf_config["DistributionConfig"]
        etag = cf_config["ETag"]
        
        updated = False
        for origin in config["Origins"]["Items"]:
            if origin["Id"] == "EC2-backend":
                if origin["DomainName"] != new_dns:
                    print(f"    Updating CloudFront origin: {origin['DomainName']} -> {new_dns}")
                    origin["DomainName"] = new_dns
                    updated = True
                else:
                    print("    CloudFront origin already matches new DNS.")
        
        if updated:
            cf.update_distribution(
                Id=CLOUDFRONT_DISTRIBUTION_ID,
                DistributionConfig=config,
                IfMatch=etag
            )
            print("[OK] CloudFront origin updated successfully.")
            
        print("[*] Verifying health at https://d2r7skqvt7wngo.cloudfront.net/api/health ...")
        import urllib.request
        for _ in range(15):
            time.sleep(4)
            try:
                req = urllib.request.Request(f"{CLOUDFRONT_URL}/api/health", headers={"User-Agent": "cloud-control"})
                with urllib.request.urlopen(req, timeout=5) as r:
                    if r.status == 200:
                        print(f"[OK] SupplyGraph is 100% LIVE and HEALTHY at {CLOUDFRONT_URL}!")
                        return
            except Exception:
                print("    Waiting for Docker containers on EC2 to initialize...")
        print(f"[OK] EC2 is running. Frontend URL: {CLOUDFRONT_URL}")
        
    except Exception as e:
        print(f"[!] Error starting instance: {e}")

if __name__ == "__main__":
    action = sys.argv[1].lower() if len(sys.argv) > 1 else "status"
    if action == "status":
        get_status()
    elif action == "stop":
        stop_instance()
    elif action == "start":
        start_instance()
    else:
        print("Usage: python cloud_control.py [status|stop|start]")
