variable "aws_region" {
  description = "AWS region. Must match where your verified SES senders live."
  type        = string
  default     = "eu-west-1"
}

variable "project" {
  type    = string
  default = "sendify"
}

variable "environment" {
  type    = string
  default = "prod"
}

# ── Networking ─────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}

variable "az_count" {
  description = "Number of AZs to span (RDS Multi-AZ needs ≥2)."
  type        = number
  default     = 3
}

# ── Database ───────────────────────────────────────────────────────────────

variable "db_name" {
  type    = string
  default = "sendify"
}

variable "db_username" {
  type    = string
  default = "sendify"
}

variable "db_instance_class" {
  description = "Right-sized for 1.5M customers + 20M sends/month."
  type        = string
  default     = "db.m6g.large"
}

variable "db_allocated_storage_gb" {
  type    = number
  default = 100
}

variable "db_max_storage_gb" {
  description = "RDS will auto-grow storage up to this ceiling."
  type        = number
  default     = 500
}

# ── Redis ──────────────────────────────────────────────────────────────────

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.medium"
}

# ── ECS ────────────────────────────────────────────────────────────────────

variable "worker_cpu" {
  type    = number
  default = 1024 # 1 vCPU
}

variable "worker_memory" {
  type    = number
  default = 2048 # 2 GB
}

variable "worker_desired_count" {
  type    = number
  default = 2
}

variable "deploy_ui_to_ecs" {
  description = "Set true if you want the Next.js UI on ECS instead of Vercel. Defaults false (Vercel)."
  type        = bool
  default     = false
}

# ── DNS ────────────────────────────────────────────────────────────────────

variable "enable_dns" {
  description = "Whether to manage DNS via Route 53. Set false if your zone lives elsewhere."
  type        = bool
  default     = false
}

variable "root_domain" {
  description = "e.g. divainparfums.com — required when enable_dns = true."
  type        = string
  default     = ""
}
