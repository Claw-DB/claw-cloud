variable "project_name" {
  type        = string
  description = "Project identifier"
  default     = "claw-cloud"
}

variable "environment" {
  type        = string
  description = "Deployment environment"
  default     = "prod"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the primary VPC"
  default     = "10.30.0.0/16"
}

variable "cloudflare_api_token" {
  type        = string
  description = "Cloudflare API token"
  sensitive   = true
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Cloudflare zone id"
}

variable "app_hostname" {
  type        = string
  description = "Dashboard hostname"
  default     = "app"
}

variable "api_hostname" {
  type        = string
  description = "API hostname"
  default     = "api"
}

variable "app_origin" {
  type        = string
  description = "Origin URL for the web app"
}

variable "api_origin" {
  type        = string
  description = "Origin URL for the API"
}
