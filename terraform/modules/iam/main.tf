data "aws_caller_identity" "this" {

}

data "aws_region" "current" {

}

resource "aws_iam_role" "lambda" {
  name = "${var.name}-lambda"
  assume_role_policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Effect = "Allow", Principal = {
        Service = "lambda.amazonaws.com"
      }, Action = "sts:AssumeRole"
      }
    ]
    }
  )
}

resource "aws_iam_role_policy" "lambda" {
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17", Statement = [
      {
        Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = var.secret_arn
      },
      {
        Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:${data.aws_region.current.region}:${data.aws_caller_identity.this.account_id}:log-group:/aws/lambda/${var.name}-*:log-stream:*"
      },
      {
        Effect = "Allow", Action = ["ec2:CreateNetworkInterface", "ec2:DescribeNetworkInterfaces", "ec2:DescribeSubnets", "ec2:DeleteNetworkInterface", "ec2:AssignPrivateIpAddresses", "ec2:UnassignPrivateIpAddresses"], Resource = "*"
      }

    ]
    }
  )
}

resource "aws_iam_openid_connect_provider" "github" {
  count          = var.github_oidc_provider_arn == "" ? 1 : 0
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

locals {
  oidc_arn = var.github_oidc_provider_arn != "" ? var.github_oidc_provider_arn : aws_iam_openid_connect_provider.github[0].arn
}

resource "aws_iam_role" "github" {
  name = "${var.name}-github-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Effect = "Allow", Principal = {
        Federated = local.oidc_arn
        }, Action = "sts:AssumeRoleWithWebIdentity", Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com", "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:environment:${var.environment}"
        }

      }

      }
    ]
    }
  )
}

resource "aws_iam_role_policy" "github" {
  role = aws_iam_role.github.id
  policy = jsonencode({
    Version = "2012-10-17", Statement = [
      {
        Effect = "Allow", Action = ["s3:ListBucket"], Resource = var.bucket_arn
      },
      {
        Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource = "${var.bucket_arn}/*"
      },
      {
        Effect = "Allow", Action = ["lambda:UpdateFunctionCode", "lambda:GetFunction", "lambda:InvokeFunction"], Resource = "arn:aws:lambda:${data.aws_region.current.region}:${data.aws_caller_identity.this.account_id}:function:${var.name}-*"
      },
      {
        Effect = "Allow", Action = ["cloudfront:CreateInvalidation"], Resource = "arn:aws:cloudfront::${data.aws_caller_identity.this.account_id}:distribution/*"
      }

    ]
    }
  )
}

resource "aws_iam_role" "terraform" {
  name               = "${var.name}-terraform"
  assume_role_policy = aws_iam_role.github.assume_role_policy
}

resource "aws_iam_role_policy" "terraform" {
  role = aws_iam_role.terraform.id
  policy = jsonencode({
    Version = "2012-10-17", Statement = [
      {
        Effect = "Allow", Action = ["s3:ListBucket"], Resource = "arn:aws:s3:::${var.state_bucket_name}"
      },
      {
        Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject"], Resource = "arn:aws:s3:::${var.state_bucket_name}/church-management/${var.environment}/terraform.tfstate"
      },
      {
        Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource = "arn:aws:s3:::${var.state_bucket_name}/church-management/${var.environment}/terraform.tfstate.tflock"
      },
      {
        Effect = "Allow", Action = ["ec2:Describe*", "ec2:CreateVpc", "ec2:DeleteVpc", "ec2:ModifyVpcAttribute", "ec2:CreateSubnet", "ec2:DeleteSubnet", "ec2:CreateRouteTable", "ec2:DeleteRouteTable", "ec2:CreateRoute", "ec2:DeleteRoute", "ec2:AssociateRouteTable", "ec2:DisassociateRouteTable", "ec2:CreateInternetGateway", "ec2:DeleteInternetGateway", "ec2:AttachInternetGateway", "ec2:DetachInternetGateway", "ec2:CreateSecurityGroup", "ec2:DeleteSecurityGroup", "ec2:AuthorizeSecurityGroupIngress", "ec2:AuthorizeSecurityGroupEgress", "ec2:RevokeSecurityGroupIngress", "ec2:RevokeSecurityGroupEgress", "ec2:ModifySecurityGroupRules", "ec2:AllocateAddress", "ec2:ReleaseAddress", "ec2:CreateNatGateway", "ec2:DeleteNatGateway", "ec2:CreateVpcEndpoint", "ec2:ModifyVpcEndpoint", "ec2:DeleteVpcEndpoints", "ec2:CreateTags", "ec2:DeleteTags", "rds:Describe*", "rds:CreateDBInstance", "rds:ModifyDBInstance", "rds:DeleteDBInstance", "rds:CreateDBSubnetGroup", "rds:ModifyDBSubnetGroup", "rds:DeleteDBSubnetGroup", "rds:CreateDBParameterGroup", "rds:ModifyDBParameterGroup", "rds:DeleteDBParameterGroup", "rds:AddTagsToResource", "rds:RemoveTagsFromResource", "rds:ListTagsForResource", "secretsmanager:CreateSecret", "secretsmanager:TagResource", "kms:DescribeKey", "kms:CreateGrant"], Resource = "*", Condition = {
          StringEquals = {
            "aws:RequestedRegion" = data.aws_region.current.region
          }

        }

      },
      {
        Effect = "Allow", Action = ["lambda:CreateFunction", "lambda:GetFunction", "lambda:GetFunctionConfiguration", "lambda:UpdateFunctionCode", "lambda:UpdateFunctionConfiguration", "lambda:DeleteFunction", "lambda:AddPermission", "lambda:RemovePermission", "lambda:GetPolicy", "lambda:TagResource", "lambda:UntagResource", "lambda:ListTags", "lambda:PutFunctionConcurrency", "lambda:DeleteFunctionConcurrency", "lambda:GetFunctionConcurrency"], Resource = "arn:aws:lambda:${data.aws_region.current.region}:${data.aws_caller_identity.this.account_id}:function:${var.name}-*"
      },
      {
        Effect = "Allow", Action = ["iam:GetRole", "iam:CreateRole", "iam:DeleteRole", "iam:UpdateAssumeRolePolicy", "iam:PutRolePolicy", "iam:GetRolePolicy", "iam:DeleteRolePolicy", "iam:ListRolePolicies", "iam:ListAttachedRolePolicies", "iam:TagRole", "iam:UntagRole", "iam:PassRole"], Resource = "arn:aws:iam::${data.aws_caller_identity.this.account_id}:role/${var.name}-*"
      },
      {
        Effect = "Allow", Action = ["iam:GetOpenIDConnectProvider", "iam:ListOpenIDConnectProviders"], Resource = "*"
      },
      {
        Effect = "Allow", Action = ["s3:CreateBucket", "s3:DeleteBucket", "s3:GetBucket*", "s3:PutBucket*", "s3:DeleteBucketPolicy", "s3:GetEncryptionConfiguration", "s3:PutEncryptionConfiguration", "s3:GetBucketPublicAccessBlock", "s3:PutBucketPublicAccessBlock", "s3:GetBucketVersioning", "s3:PutBucketVersioning", "s3:ListBucket"], Resource = "arn:aws:s3:::${var.name}-web-*"
      },
      {
        Effect = "Allow", Action = ["cloudfront:CreateDistribution", "cloudfront:GetDistribution", "cloudfront:GetDistributionConfig", "cloudfront:UpdateDistribution", "cloudfront:DeleteDistribution", "cloudfront:CreateOriginAccessControl", "cloudfront:GetOriginAccessControl", "cloudfront:UpdateOriginAccessControl", "cloudfront:DeleteOriginAccessControl", "cloudfront:CreateResponseHeadersPolicy", "cloudfront:GetResponseHeadersPolicy", "cloudfront:UpdateResponseHeadersPolicy", "cloudfront:DeleteResponseHeadersPolicy", "cloudfront:ListTagsForResource", "cloudfront:TagResource", "cloudfront:UntagResource"], Resource = "*"
      },
      {
        Effect = "Allow", Action = ["cognito-idp:CreateUserPool", "cognito-idp:DescribeUserPool", "cognito-idp:UpdateUserPool", "cognito-idp:DeleteUserPool", "cognito-idp:CreateUserPoolClient", "cognito-idp:DescribeUserPoolClient", "cognito-idp:UpdateUserPoolClient", "cognito-idp:DeleteUserPoolClient", "cognito-idp:ListTagsForResource", "cognito-idp:TagResource", "cognito-idp:UntagResource", "apigateway:GET", "apigateway:POST", "apigateway:PUT", "apigateway:PATCH", "apigateway:DELETE"], Resource = "*", Condition = {
          StringEquals = {
            "aws:RequestedRegion" = data.aws_region.current.region
          }

        }

      },
      {
        Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:DeleteLogGroup", "logs:PutRetentionPolicy", "logs:DeleteRetentionPolicy", "logs:DescribeLogGroups", "logs:ListTagsForResource", "logs:TagResource", "logs:UntagResource", "cloudwatch:PutMetricAlarm", "cloudwatch:DeleteAlarms", "cloudwatch:DescribeAlarms", "cloudwatch:ListTagsForResource", "cloudwatch:TagResource", "cloudwatch:UntagResource", "sns:CreateTopic", "sns:DeleteTopic", "sns:GetTopicAttributes", "sns:SetTopicAttributes", "sns:Subscribe", "sns:Unsubscribe", "sns:GetSubscriptionAttributes", "sns:ListTagsForResource", "sns:TagResource", "sns:UntagResource"], Resource = "*", Condition = {
          StringEquals = {
            "aws:RequestedRegion" = data.aws_region.current.region
          }

        }

      }

    ]
    }
  )
}

