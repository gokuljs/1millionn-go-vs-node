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


variable "app_image_digest" {
  description = "SHA256 digest of the linux/amd64 application image already published to our ECR repository."
  type        = string
  nullable    = false

  validation {
    condition     = can(regex("^sha256:[0-9a-f]{64}$", var.app_image_digest))
    error_message = "Provide the published image digest: sha256: followed by 64 lowercase hexadecimal characters."
  }
}

resource "aws_iam_instance_profile" "app" {
  name = "1million-nodejs-ec2-lab"
  role = aws_iam_role.app.name
}
