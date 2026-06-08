module "s3" {
  source   = "./modules/s3"
  app_name = var.app_name
  region   = var.aws_region
}

module "ecr" {
  source   = "./modules/ecr"
  app_name = var.app_name
}

module "sqs" {
  source   = "./modules/sqs"
  app_name = var.app_name
}

module "cloudwatch" {
  source   = "./modules/cloudwatch"
  app_name = var.app_name
  region   = var.aws_region
}

module "iam" {
  source          = "./modules/iam"
  app_name        = var.app_name
  aws_account_id  = data.aws_caller_identity.current.account_id
  aws_region      = var.aws_region
  github_org      = var.github_org
  github_repo     = var.github_repo
  s3_uploads_arn  = module.s3.uploads_bucket_arn
  s3_frontend_arn = module.s3.frontend_bucket_arn
  s3_models_arn   = module.s3.models_bucket_arn
  ecr_arns        = module.ecr.repository_arns
  sqs_queue_arn   = module.sqs.queue_arn
  dynamodb_table_arn = module.dynamodb.table_arn
}

module "ec2" {
  source        = "./modules/ec2"
  app_name      = var.app_name
  ec2_role_name = module.iam.ec2_instance_profile_name
  key_pair_name = var.ec2_key_pair_name
  your_ip_cidr  = var.your_ip_cidr
}

module "cloudfront" {
  source              = "./modules/cloudfront"
  app_name            = var.app_name
  frontend_bucket_id  = module.s3.frontend_bucket_id
  frontend_bucket_arn = module.s3.frontend_bucket_arn
  ec2_public_dns      = module.ec2.public_dns
}

module "dynamodb" {
  source   = "./modules/dynamodb"
  app_name = var.app_name
}

data "aws_caller_identity" "current" {}
