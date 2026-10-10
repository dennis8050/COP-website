data "archive_file" "this" {
  type        = "zip"
  source_dir  = "${path.root}/../backend/dist"
  output_path = "${path.root}/api.zip"
}

resource "aws_lambda_function" "api" {
  function_name                  = "${var.name}-api"
  role                           = var.role_arn
  filename                       = data.archive_file.this.output_path
  source_code_hash               = data.archive_file.this.output_base64sha256
  runtime                        = "nodejs22.x"
  handler                        = "handler.handler"
  timeout                        = 28
  memory_size                    = 256
  reserved_concurrent_executions = 10
  environment {
    variables = var.environment
  }

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_id]
  }

}

resource "aws_lambda_function" "migrate" {
  function_name    = "${var.name}-migrate"
  role             = var.role_arn
  filename         = data.archive_file.this.output_path
  source_code_hash = data.archive_file.this.output_base64sha256
  runtime          = "nodejs22.x"
  handler          = "migrate.handler"
  timeout          = 120
  memory_size      = 256
  environment {
    variables = var.environment
  }

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_id]
  }

}

resource "aws_cloudwatch_log_group" "migration" {
  name              = "/aws/lambda/${var.name}-migrate"
  retention_in_days = 30
}

