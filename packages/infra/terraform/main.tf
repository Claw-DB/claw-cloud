terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

module "aws" {
  source = "./modules/aws"

  project_name = var.project_name
  environment  = var.environment
  vpc_cidr     = var.vpc_cidr
  region       = var.aws_region
}

module "cloudflare" {
  source = "./modules/cloudflare"

  zone_id      = var.cloudflare_zone_id
  app_hostname = var.app_hostname
  api_hostname = var.api_hostname
  app_origin   = var.app_origin
  api_origin   = var.api_origin
}
