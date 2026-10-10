resource "aws_cognito_user_pool" "this" {
  name                     = var.name
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  lambda_config {
    post_confirmation = aws_lambda_function.provision.arn
  }

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }

  }


}

resource "aws_cognito_user_pool_client" "this" {
  name                          = var.name
  user_pool_id                  = aws_cognito_user_pool.this.id
  generate_secret               = false
  explicit_auth_flows           = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  prevent_user_existence_errors = "ENABLED"
  access_token_validity         = 1
  id_token_validity             = 1
  refresh_token_validity        = 7
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

}

data "archive_file" "provision" {
  type        = "zip"
  source_dir  = "${path.root}/../backend/dist"
  output_path = "${path.root}/provision.zip"
}

resource "aws_lambda_function" "provision" {
  function_name    = "${var.name}-provision"
  role             = var.role_arn
  filename         = data.archive_file.provision.output_path
  source_code_hash = data.archive_file.provision.output_base64sha256
  runtime          = "nodejs22.x"
  handler          = "provision.handler"
  timeout          = 10
  memory_size      = 256
  environment {
    variables = var.environment
  }

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_id]
  }

}

resource "aws_lambda_permission" "cognito" {
  statement_id  = "CognitoPostConfirmation"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.provision.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.this.arn
}

resource "aws_cloudwatch_log_group" "provision" {
  name              = "/aws/lambda/${var.name}-provision"
  retention_in_days = 30
}

