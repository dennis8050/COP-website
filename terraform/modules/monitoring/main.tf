resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = var.retention_days
}

resource "aws_sns_topic" "alerts" {
  name = "${var.name}-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

resource "aws_cloudwatch_metric_alarm" "errors" {
  alarm_name  = "${var.name}-lambda-errors"
  namespace   = "AWS/Lambda"
  metric_name = "Errors"
  dimensions = {
    FunctionName = var.function_name
  }

  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 3
  evaluation_periods  = 1
  period              = 300
  statistic           = "Sum"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

