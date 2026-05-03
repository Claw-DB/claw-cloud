output "vpc_id" {
  value = module.aws.vpc_id
}

output "public_subnets" {
  value = module.aws.public_subnets
}

output "app_record" {
  value = module.cloudflare.app_record
}

output "api_record" {
  value = module.cloudflare.api_record
}
