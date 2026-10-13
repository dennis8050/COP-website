variable "aws_region" {
  type    = string
  default = "ca-central-1"
}

variable "project_name" {
  type    = string
  default = "church-management"
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging or production."
  }

}

variable "database_name" {
  type    = string
  default = "church"
}

variable "database_username" {
  type    = string
  default = "church_admin"
}

variable "instance_size" {
  type    = string
  default = "db.t4g.micro"
}

variable "github_repository" {
  type        = string
  description = "Exact owner/repository for GitHub OIDC trust"
}

variable "github_oidc_provider_arn" {
  type        = string
  default     = ""
  description = "Existing account GitHub OIDC provider ARN; leave blank to create once."
}

variable "alarm_email" {
  type = string
}

variable "frontend_origin" {
  type        = string
  default     = ""
  description = "Optional custom HTTPS frontend origin. CloudFront domain used when empty."
}

variable "state_bucket_name" {
  type        = string
  description = "Bootstrap state bucket for infrastructure OIDC role"
}


variable "sms_send_enabled" {
  type = bool
  default = false
  description = "Second independent safety gate; leave false until consent, provider registration and testing are complete."
}
