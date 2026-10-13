variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "lambda_sg_id" {
  type = string
}

variable "database_name" {
  type = string
}

variable "username" {
  type = string
}

variable "instance_size" {
  type = string
}

variable "production" {
  type = bool
}

