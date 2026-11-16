resource "aws_ecr_repository" "app" {
  name                 = "1million-testing-nodejs-lab"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = true

  encryption_configuration {
    encryption_type = "AES256"
  }

  image_scanning_configuration {
    scan_on_push = true
  }
}

data "aws_ssm_parameter" "app_image_digest" {
  name            = "/1million/lab/app-image-digest"
  with_decryption = false

  lifecycle {
    postcondition {
      condition     = can(regex("^sha256:[0-9a-f]{64}$", self.value))
      error_message = "The image digest parameter must contain sha256: followed by 64 lowercase hexadecimal characters."
    }
  }
}
