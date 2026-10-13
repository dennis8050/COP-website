output "api_url" {
  value = module.api_gateway.url
}

output "frontend_bucket" {
  value = module.s3.id
}

output "cloudfront_distribution_id" {
  value = module.cloudfront.id
}

output "frontend_url" {
  value = "https://${module.cloudfront.domain}"
}

output "cognito_user_pool_id" {
  value = module.cognito.pool_id
}

output "cognito_client_id" {
  value = module.cognito.client_id
}

output "rds_endpoint" {
  value = module.rds.endpoint
}

output "github_deploy_role_arn" {
  value = module.iam.github_role_arn
}

output "migration_function_name" {
  value = module.lambda.migration_name
}

output "api_function_name" {
  value = module.lambda.function_name
}

output "github_terraform_role_arn" {
  value = module.iam.terraform_role_arn
}

output "provision_function_name" {
  value = "${local.name}-provision"
}

