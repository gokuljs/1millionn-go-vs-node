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

variable "api_client_cidr" {
  description = "Public IPv4 address allowed to access the lab API."
  type        = string
  nullable    = false

  validation {
    condition = (
      can(cidrnetmask(var.api_client_cidr)) &&
      endswith(var.api_client_cidr, "/32")
    )
    error_message = "Provide one IPv4 address followed by /32."
  }
}
