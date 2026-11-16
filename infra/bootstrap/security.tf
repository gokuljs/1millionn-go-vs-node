resource "aws_security_group" "app" {
  name        = "1million-app"
  description = "Network access for the Node.js lab"
  vpc_id      = aws_vpc.lab.id

  tags = {
    Name = "1million-app"
  }
}

resource "aws_vpc_security_group_ingress_rule" "api" {
  security_group_id = aws_security_group.app.id
  description       = "HTTP API through Nginx from the testing IP"
  cidr_ipv4         = var.api_client_cidr
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_egress_rule" "https" {
  security_group_id = aws_security_group.app.id
  description       = "HTTPS downloads and AWS service access"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}
