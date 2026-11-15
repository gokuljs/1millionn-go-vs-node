variable "aws_region" {
  description = "AWS region for the experiment."
  type        = string
}

variable "aws_account_id" {
  description = "AWS account approved for the experiment."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "The AWS account ID must contain exactly 12 digits."
  }
}