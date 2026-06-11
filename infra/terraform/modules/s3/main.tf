variable "app_name" {
  type = string
}

variable "region" {
  type = string
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "frontend" {
  bucket        = "${var.app_name}-frontend-${random_id.bucket_suffix.hex}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket" "uploads" {
  bucket        = "${var.app_name}-uploads-${random_id.bucket_suffix.hex}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "GET"]
    allowed_origins = ["*"] # Lock down to CF domain / custom domains later
    max_age_seconds = 3000
  }
}

output "frontend_bucket_id" {
  value = aws_s3_bucket.frontend.id
}

output "frontend_bucket_arn" {
  value = aws_s3_bucket.frontend.arn
}

output "uploads_bucket_id" {
  value = aws_s3_bucket.uploads.id
}

output "uploads_bucket_arn" {
  value = aws_s3_bucket.uploads.arn
}

# ── ML Model Weights Bucket ───────────────────────────────────────────────────
# Stores serialized PyTorch STGT model state dicts (base + per-company)
# Layout:
#   models/base/base_stgt_model.pkl            ← base pre-trained STGT model
#   models/<companyId>/model_weights.pkl       ← fine-tuned company model
resource "aws_s3_bucket" "models" {
  bucket        = "${var.app_name}-models-${random_id.bucket_suffix.hex}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "models" {
  bucket                  = aws_s3_bucket.models.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "models_bucket_id" {
  value = aws_s3_bucket.models.id
}

output "models_bucket_arn" {
  value = aws_s3_bucket.models.arn
}
