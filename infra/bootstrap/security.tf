resource "aws_security_group" "app" {
  name        = "1million-app"
  description = "Network access for the Node.js lab"
  vpc_id      = aws_vpc.lab.id

  tags = {
    Name = "1million-app"
  }
}