data "aws_region" "current" {

}

resource "aws_security_group" "endpoint" {
  name   = "${var.name}-secrets-endpoint"
  vpc_id = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id            = aws_security_group.endpoint.id
  referenced_security_group_id = var.lambda_sg_id
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
}

resource "aws_vpc_endpoint" "secrets" {
  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${data.aws_region.current.region}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.subnet_ids
  security_group_ids  = [aws_security_group.endpoint.id]
  private_dns_enabled = true
  policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Effect = "Allow", Principal = "*", Action = ["secretsmanager:GetSecretValue"], Resource = var.secret_arn
      }
    ]
    }
  )
}

