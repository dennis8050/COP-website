# Troubleshooting

- Database connection refused: run Docker Compose, wait for health check, check local password and URL encoding.
- Login fails locally: set development/local auth and seed with DEMO_PASSWORD; local sessions reset on refresh.
- New Cognito login returns account inactive: migration must run before signup. Check post-confirmation Lambda logs; recreate/repair the profile through private maintenance, never grant public role choice.
- Lambda database TLS error: refresh official global RDS CA bundle and rebuild; never disable certificate verification.
- JWT network timeout: check private subnet NAT route, public subnet IGW route and security-group HTTPS egress.
- Secrets Manager timeout: check interface endpoint, private DNS and endpoint security group.
- Duplicate scan: 409 is expected; unique member/service constraint prevents a second check-in.
- Camera unavailable: HTTPS or localhost, grant browser camera permission, close other camera apps. Desktop browsers may need a selected webcam; environment facing mode is a preference.
- QR not recognized: use the downloaded member QR, not a URL or photo containing unrelated codes. Check active member status and rotate compromised tokens.
- 403: role may not permit the operation; STAFF cannot edit members or attendance corrections.
- Empty dashboard: select a date range containing services; seed data is relative to the date the script runs.
- Terraform backend errors: create the bootstrap bucket first and verify state-key/lockfile IAM access.
- GitHub AssumeRole denied: match exact repository/environment subject and set repository environment branch rules.
- Terraform OIDC provider already exists: set existing provider ARN for additional environments.
- Costs higher than expected: NAT and PrivateLink are hourly resources even with zero users; destroy dev only after backing up needed data.
