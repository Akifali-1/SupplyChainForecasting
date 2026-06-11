"""
DynamoDB + S3 helpers for the ML Service.

Provides:
  - DynamoDBClient  – thin wrapper around boto3 DynamoDB Document client
  - S3ModelStore    – upload/download PyTorch model weights to/from S3

Table design (single-table):
  PK               SK                    Record type
  COMPANY#<id>     METADATA              Company metadata
  COMPANY#<id>     USER#<googleId>       User record
  COMPANY#<id>     INVITE#<token>        Invite token
  COMPANY#<id>     INVENTORY             Inventory snapshot
  COMPANY#<id>     MODEL                 Fine-tuned ML model metadata
  COMPANY#<id>     TRAINING_STATUS       Training progress
  COMPANY#<id>     PREDICTION_CACHE      Cached batch predictions
  COMPANY#base     MODEL                 Base (pre-trained) model metadata
"""

import os
import io
import boto3
from botocore.exceptions import ClientError


# ── DynamoDB Client ──────────────────────────────────────────────────────────

class DynamoDBClient:
    """
    Thin wrapper around the boto3 DynamoDB Table resource.
    All operations operate on the SupplyGraph-Prod single table.
    """

    def __init__(self):
        self.table_name = os.getenv("DYNAMODB_TABLE", "SupplyGraph-Prod")
        self.region = os.getenv("AWS_REGION", "us-east-1")
        self._table = None
        self._init()

    def _init(self):
        try:
            dynamodb = boto3.resource("dynamodb", region_name=self.region)
            self._table = dynamodb.Table(self.table_name)
            # Probe the table to confirm connectivity (raises if unreachable)
            self._table.table_status  # Triggers a DescribeTable call
            print(f"✅ Connected to DynamoDB table: {self.table_name}")
        except Exception as e:
            print(f"⚠️  DynamoDB connection failed: {e}")
            self._table = None

    @property
    def is_connected(self):
        return self._table is not None

    def get_item(self, pk, sk):
        """Return item dict or None if not found."""
        if not self.is_connected:
            return None
        try:
            resp = self._table.get_item(Key={"PK": pk, "SK": sk})
            return resp.get("Item")
        except ClientError as e:
            print(f"DynamoDB get_item error: {e}")
            return None

    def put_item(self, item: dict):
        """Put (create or overwrite) a single item."""
        if not self.is_connected:
            raise RuntimeError("DynamoDB not connected")
        self._table.put_item(Item=item)

    def update_item(self, pk, sk, updates: dict):
        """
        Perform a partial update on an existing item.
        `updates` is a plain dict of attribute_name -> new_value.
        """
        if not self.is_connected:
            raise RuntimeError("DynamoDB not connected")

        set_expr = ", ".join(f"#a{i} = :v{i}" for i, _ in enumerate(updates))
        expr_names = {f"#a{i}": k for i, k in enumerate(updates)}
        expr_values = {f":v{i}": v for i, v in enumerate(updates.values())}

        self._table.update_item(
            Key={"PK": pk, "SK": sk},
            UpdateExpression=f"SET {set_expr}",
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values,
        )

    def delete_item(self, pk, sk):
        """Delete a single item by key."""
        if not self.is_connected:
            return
        try:
            self._table.delete_item(Key={"PK": pk, "SK": sk})
        except ClientError as e:
            print(f"DynamoDB delete_item error: {e}")

    def query_by_pk(self, pk, sk_prefix=None):
        """
        Query all items for a given PK.
        Optionally filter where SK begins_with sk_prefix.
        Returns list of items.
        """
        if not self.is_connected:
            return []
        try:
            kwargs = {
                "KeyConditionExpression": boto3.dynamodb.conditions.Key("PK").eq(pk)
            }
            if sk_prefix:
                kwargs["KeyConditionExpression"] = (
                    boto3.dynamodb.conditions.Key("PK").eq(pk)
                    & boto3.dynamodb.conditions.Key("SK").begins_with(sk_prefix)
                )
            resp = self._table.query(**kwargs)
            return resp.get("Items", [])
        except ClientError as e:
            print(f"DynamoDB query error: {e}")
            return []

    def query_gsi1(self, gsi1_pk, gsi1_sk=None):
        """
        Query via the GSI1 global secondary index.
        Used for reverse lookups (e.g. find user by googleId, find invite by token).
        Returns list of items.
        """
        if not self.is_connected:
            return []
        try:
            kwargs = {
                "IndexName": "GSI1",
                "KeyConditionExpression": boto3.dynamodb.conditions.Key("GSI1_PK").eq(gsi1_pk),
            }
            if gsi1_sk:
                kwargs["KeyConditionExpression"] = (
                    boto3.dynamodb.conditions.Key("GSI1_PK").eq(gsi1_pk)
                    & boto3.dynamodb.conditions.Key("GSI1_SK").eq(gsi1_sk)
                )
            resp = self._table.query(**kwargs)
            return resp.get("Items", [])
        except ClientError as e:
            print(f"DynamoDB GSI1 query error: {e}")
            return []


# ── S3 Model Store ───────────────────────────────────────────────────────────

class S3ModelStore:
    """
    Upload and download raw model bytes (pickle of PyTorch state dicts) to S3.

    Bucket layout:
      models/base/base_stgt_model.pkl           ← base pre-trained STGT model
      models/<companyId>/model_weights.pkl      ← fine-tuned company model
    """

    def __init__(self):
        self.bucket = os.getenv("S3_MODELS_BUCKET")
        self.region = os.getenv("AWS_REGION", "us-east-1")
        if self.bucket:
            self._client = boto3.client("s3", region_name=self.region)
            print(f"✅ S3ModelStore: using bucket {self.bucket}")
        else:
            self._client = None
            print("⚠️  S3_MODELS_BUCKET not set — model storage disabled")

    @property
    def is_configured(self):
        return self._client is not None and self.bucket is not None

    def upload(self, model_bytes: bytes, s3_key: str) -> str:
        """Upload model_bytes to s3://<bucket>/<s3_key>. Returns full S3 URI."""
        if not self.is_configured:
            raise RuntimeError("S3ModelStore not configured (S3_MODELS_BUCKET missing)")
        self._client.put_object(
            Bucket=self.bucket,
            Key=s3_key,
            Body=model_bytes,
            ContentType="application/octet-stream",
        )
        uri = f"s3://{self.bucket}/{s3_key}"
        print(f"✅ Model uploaded to {uri} ({len(model_bytes) / 1024 / 1024:.2f} MB)")
        return uri

    def download(self, s3_uri: str) -> bytes:
        """Download model bytes from an S3 URI (s3://bucket/key)."""
        if not self.is_configured:
            raise RuntimeError("S3ModelStore not configured")
        # Parse URI
        if s3_uri.startswith("s3://"):
            parts = s3_uri[5:].split("/", 1)
            bucket, key = parts[0], parts[1]
        else:
            bucket, key = self.bucket, s3_uri  # Treat as bare key

        response = self._client.get_object(Bucket=bucket, Key=key)
        data = response["Body"].read()
        print(f"✅ Model downloaded from s3://{bucket}/{key} ({len(data) / 1024 / 1024:.2f} MB)")
        return data

    def delete(self, s3_key: str):
        """Delete a model file from S3."""
        if not self.is_configured:
            return
        try:
            self._client.delete_object(Bucket=self.bucket, Key=s3_key)
        except ClientError as e:
            print(f"S3 delete error: {e}")
