terraform {
  required_version = ">= 1.7"

  required_providers {
    aws    = { source = "hashicorp/aws",    version = "~> 5.70" }
    random = { source = "hashicorp/random", version = "~> 3.6"  }
  }

  # Comment this out for the very first apply, then uncomment after creating the bucket.
  backend "s3" {
    bucket  = "divain-terraform-state"
    key     = "sendify/terraform.tfstate"
    region  = "eu-west-1"
    encrypt = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project    = "Sendify"
      ManagedBy  = "Terraform"
      Owner      = "divain"
    }
  }
}
