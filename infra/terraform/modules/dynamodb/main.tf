variable "app_name" {
  type = string
}

# ── Single-table DynamoDB ─────────────────────────────────────────────────────
# PK = partition key (e.g. COMPANY#<id>)
# SK = sort key     (e.g. METADATA | USER#<googleId> | INVITE#<token> | INVENTORY | MODEL | TRAINING_STATUS | PREDICTION_CACHE)
# GSI1 is used for reverse lookups (e.g. find user by googleId, find invite by token)
resource "aws_dynamodb_table" "main" {
  name         = "${var.app_name}-Prod"
  billing_mode = "PAY_PER_REQUEST"   # serverless – costs nothing when idle
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1_PK"
    type = "S"
  }

  attribute {
    name = "GSI1_SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1_PK"
    range_key       = "GSI1_SK"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name        = "${var.app_name}-Prod"
    Application = var.app_name
    ManagedBy   = "Terraform"
  }
}

output "table_name" {
  value = aws_dynamodb_table.main.name
}

output "table_arn" {
  value = aws_dynamodb_table.main.arn
}
