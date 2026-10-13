variable "name" {
  type = string
}

variable "role_arn" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "security_group_id" {
  type = string
}

variable "environment" {
  type = map(string)
}


variable "followup_role_arn" {
  type = string
}
