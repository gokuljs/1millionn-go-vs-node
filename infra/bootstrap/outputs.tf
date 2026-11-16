output "instance_public_ip" {
  description = "Public IPv4 address of the lab EC2 instance."
  value       = aws_instance.app.public_ip
}

output "app_url" {
  description = "HTTP API endpoint through Nginx; restricted to api_client_cidr."
  value       = "http://${aws_instance.app.public_ip}/api/ping"
}

output "image_repository_url" {
  description = "Private repository where the build pipeline publishes the app image."
  value       = aws_ecr_repository.app.repository_url
}
