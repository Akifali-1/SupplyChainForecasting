variable "app_name" {
  type = string
}

resource "aws_sqs_queue" "ml_jobs" {
  name                       = "${var.app_name}-ml-jobs"
  visibility_timeout_seconds = 900   # 15 mins (ML training can take this long)
  message_retention_seconds  = 86400 # 24 hours
  receive_wait_time_seconds  = 20    # Long polling

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.ml_jobs_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue" "ml_jobs_dlq" {
  name                      = "${var.app_name}-ml-jobs-dlq"
  message_retention_seconds = 604800 # 7 days
}

output "queue_url" {
  value = aws_sqs_queue.ml_jobs.url
}

output "queue_arn" {
  value = aws_sqs_queue.ml_jobs.arn
}

output "dlq_url" {
  value = aws_sqs_queue.ml_jobs_dlq.url
}
