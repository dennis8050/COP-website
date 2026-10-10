locals {
  name = "${var.project_name}-${var.environment}"
}

module "vpc" {
  source = "./modules/vpc"
  name   = local.name
}

module "rds" {
  source        = "./modules/rds"
  name          = local.name
  vpc_id        = module.vpc.vpc_id
  subnet_ids    = module.vpc.private_subnet_ids
  lambda_sg_id  = module.vpc.lambda_sg_id
  database_name = var.database_name
  username      = var.database_username
  instance_size = var.instance_size
  production    = var.environment == "production"
}

module "secrets_manager" {
  source       = "./modules/secrets-manager"
  name         = local.name
  secret_arn   = module.rds.secret_arn
  vpc_id       = module.vpc.vpc_id
  subnet_ids   = module.vpc.private_subnet_ids
  lambda_sg_id = module.vpc.lambda_sg_id
}

module "s3" {
  source = "./modules/s3"
  name   = local.name
}

module "cloudfront" {
  source            = "./modules/cloudfront"
  name              = local.name
  bucket_domain     = module.s3.domain
  bucket_id         = module.s3.id
  bucket_arn        = module.s3.arn
  state_bucket_name = var.state_bucket_name
}

module "cognito" {
  source            = "./modules/cognito"
  name              = local.name
  role_arn          = module.iam.lambda_role_arn
  subnet_ids        = module.vpc.private_subnet_ids
  security_group_id = module.vpc.lambda_sg_id
  environment = {
    NODE_ENV = "production", DB_SECRET_ARN = module.rds.secret_arn, DB_HOST = module.rds.endpoint, DB_NAME = var.database_name
  }

  depends_on = [module.secrets_manager]
}

module "iam" {
  source                   = "./modules/iam"
  name                     = local.name
  secret_arn               = module.rds.secret_arn
  github_repository        = var.github_repository
  environment              = var.environment
  github_oidc_provider_arn = var.github_oidc_provider_arn
  bucket_arn               = module.s3.arn
  state_bucket_name        = var.state_bucket_name
}

module "lambda" {
  source            = "./modules/lambda"
  name              = local.name
  role_arn          = module.iam.lambda_role_arn
  subnet_ids        = module.vpc.private_subnet_ids
  security_group_id = module.vpc.lambda_sg_id
  environment = {
    NODE_ENV = "production", AUTH_MODE = "cognito", DB_SECRET_ARN = module.rds.secret_arn, DB_HOST = module.rds.endpoint, DB_NAME = var.database_name, COGNITO_USER_POOL_ID = module.cognito.pool_id, COGNITO_CLIENT_ID = module.cognito.client_id, CORS_ORIGIN = var.frontend_origin != "" ? var.frontend_origin : "https://${module.cloudfront.domain}"
  }

  depends_on = [module.secrets_manager]
}

module "api_gateway" {
  source          = "./modules/api-gateway"
  name            = local.name
  lambda_arn      = module.lambda.arn
  invoke_arn      = module.lambda.invoke_arn
  frontend_origin = var.frontend_origin != "" ? var.frontend_origin : "https://${module.cloudfront.domain}"
}

module "monitoring" {
  source         = "./modules/monitoring"
  name           = local.name
  function_name  = module.lambda.function_name
  alarm_email    = var.alarm_email
  retention_days = var.environment == "production" ? 90 : 14
}

