variable "app_name" {
  type = string
}

variable "region" {
  type = string
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/${var.app_name}/backend"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "ml_service" {
  name              = "/${var.app_name}/ml-service"
  retention_in_days = 30
}

# Create a metric filter to monitor error logs in backend
resource "aws_cloudwatch_log_metric_filter" "backend_errors" {
  name           = "${var.app_name}-backend-errors-filter"
  pattern        = "ERROR"
  log_group_name = aws_cloudwatch_log_group.backend.name

  metric_transformation {
    name      = "ErrorCount"
    namespace = "${var.app_name}/Metrics"
    value     = "1"
  }
}

# Alarm: backend container crashes or log error count spikes
resource "aws_cloudwatch_metric_alarm" "backend_errors" {
  alarm_name          = "${var.app_name}-backend-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ErrorCount"
  namespace           = "${var.app_name}/Metrics"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Backend error count has exceeded 10 in 5 minutes"
}

# Alarm: SQS DLQ messages (failed ML jobs)
resource "aws_cloudwatch_metric_alarm" "sqs_dlq" {
  alarm_name          = "${var.app_name}-ml-job-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  dimensions = {
    QueueName = "${var.app_name}-ml-jobs-dlq"
  }
  alarm_description = "ML training job failed and landed in DLQ"
}
