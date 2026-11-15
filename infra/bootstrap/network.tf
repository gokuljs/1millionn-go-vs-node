resource "aws_vpc" "lab" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "1million-lab"
  }
}

resource "aws_subnet" "app" {
  vpc_id                  = aws_vpc.lab.id
  cidr_block              = "10.20.1.0/24"
  map_public_ip_on_launch = false

  tags = {
    Name = "1million-app"
  }
}

resource "aws_internet_gateway" "lab" {
  vpc_id = aws_vpc.lab.id

  tags = {
    Name = "1million-lab-igw"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.lab.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.lab.id
  }

  tags = {
    Name = "1million-public-routes"
  }
}

resource "aws_route_table_association" "app" {
  subnet_id      = aws_subnet.app.id
  route_table_id = aws_route_table.public.id
}