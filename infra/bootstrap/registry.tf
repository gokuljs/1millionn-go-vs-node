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