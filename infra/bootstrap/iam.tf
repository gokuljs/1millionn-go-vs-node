resource "aws_iam_role" "app" {
  name = "1million-nodejs-ec2-lab"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"
        Action = "sts:AssumeRole"

        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "app_ecr_pull" {
  name = "pull-app-image"
  role = aws_iam_role.app.name

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Sid      = "EcrLogin"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "PullAppImage"
        Effect = "Allow"

        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
        ]

        Resource = aws_ecr_repository.app.arn
      }
    ]
  })
}