data "aws_ssm_parameter" "amazon_linux" {
  name            = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
  with_decryption = false
}

resource "aws_instance" "app" {
  ami                         = data.aws_ssm_parameter.amazon_linux.value
  instance_type               = "t3.micro"
  subnet_id                   = aws_subnet.app.id
  associate_public_ip_address = true
  vpc_security_group_ids      = [aws_security_group.app.id]
  iam_instance_profile        = aws_iam_instance_profile.app.name

  user_data = templatefile("${path.module}/templates/startup.sh.tftpl", {
    aws_region     = var.aws_region
    repository_url = aws_ecr_repository.app.repository_url
    image_digest   = var.app_image_digest
    nginx_config   = file("${path.module}/templates/nginx.conf")
  })
  user_data_replace_on_change = true

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  tags = {
    Name = "1million-nodejs-lab"
  }

  depends_on = [
    aws_route_table_association.app,
    aws_vpc_security_group_egress_rule.https,
    aws_iam_role_policy.app_ecr_pull,
  ]
}
