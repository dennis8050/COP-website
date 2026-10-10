# AWS cost planning

Budget guidance in USD/month, excluding tax, support, domain and large outbound transfers. These are planning ranges rather than a current AWS quotation; check AWS Pricing Calculator for ca-central-1 at deployment.

| Resource                                                | Development planning range | Production planning range |
| ------------------------------------------------------- | -------------------------: | ------------------------: |
| Small PostgreSQL RDS + 20 GB gp3                        |                     $18–35 |  $55–110 (Multi-AZ small) |
| One NAT gateway + modest data                           |                     $35–50 |                    $35–55 |
| Secrets Manager two-AZ PrivateLink                      |                     $15–25 |                    $15–25 |
| Lambda, REST API, Cognito, S3, CloudFront, logs, secret |                      $3–15 |                     $5–30 |
| Total                                                   |                    $71–125 |                  $110–220 |

For 200–1,000 members infrastructure uptime, rather than attendance volume, drives cost. This deployment intentionally includes one NAT for Cognito JWKS discovery/rotation and a Secrets Manager interface endpoint, avoiding insecure networking shortcuts. Two-AZ NAT for stronger availability adds roughly another gateway’s hourly cost. Removing PrivateLink is possible if retrieving secrets through NAT, but must also change the Lambda egress policy and endpoint dependency. Free-tier eligibility varies and is not assumed. Set AWS Budgets and log retention, use gp3 autoscaling limits, and destroy unused dev environments safely. Never delete production without verified restore and approved retention.

Official sources: [RDS PostgreSQL pricing](https://aws.amazon.com/rds/postgresql/pricing/), [VPC/NAT pricing](https://aws.amazon.com/vpc/pricing/), [PrivateLink pricing](https://aws.amazon.com/privatelink/pricing/). Verify the selected region in [AWS Pricing Calculator](https://calculator.aws/).
