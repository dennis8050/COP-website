output "arn" {
  value = aws_lambda_function.api.arn
}

output "invoke_arn" {
  value = aws_lambda_function.api.invoke_arn
}

output "function_name" {
  value = aws_lambda_function.api.function_name
}

output "migration_name" {
  value = aws_lambda_function.migrate.function_name
}

