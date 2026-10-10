# Security and production checklist

- [ ] Cognito email verification, password policy, account recovery and session expiry tested.
- [ ] ADMIN/PASTOR/STAFF/MEMBER permissions tested through direct API calls, not just UI.
- [ ] Production environment uses Cognito only; no local credentials or seed users.
- [ ] Secrets Manager retrieval limited to the environment secret; no secrets in VITE variables, logs, git or Terraform variables.
- [ ] Database private, encrypted and TLS certificate validated; backups and restore tested.
- [ ] CORS exact frontend origin; HTTPS and CloudFront security headers enabled.
- [ ] API Gateway throttling, Lambda concurrency limit, CloudWatch alarms and SNS confirmation tested.
- [ ] Production GitHub environment reviewers and branch restrictions configured.
- [ ] State bucket versioning/encryption/HTTPS, least-privilege state-key access and S3 lockfile tested.
- [ ] QR duplicate/inactive/invalid-token behavior verified; staff confirm identity; compromised tokens rotated.
- [ ] Contact messages and personal data retention policy defined; only authorized staff can access member information.
- [ ] Dependency security scan reviewed (`npm audit --omit=dev`), certificates refreshed and release pinned through package-lock.json.
- [ ] First administrator bootstrapped privately; self-registration can never elevate role.
- [ ] Device tests on iOS Safari, Android Chrome and webcam; consent/privacy notice agreed by church.

Known tradeoffs: Cognito browser session handling uses Amplify's standard storage; XSS defenses and dependency hygiene are essential. QR codes are revocable attendance identifiers, not cryptographically verifiable identity proofs. A single NAT gateway has a zonal dependency. Runtime initially uses RDS’s managed database account; tighten SQL privileges for stricter production separation. Sensitive user role changes and QR rotation are audited, while attendance corrections should be reviewed against church retention requirements. Infrastructure OIDC permissions are substantially broader than runtime permissions: resource-creation APIs use region-scoped wildcards where necessary. Review them against your account permissions boundary before allowing production infrastructure changes. Generic CRUD forms currently use native browser validation and native confirmation dialogs.
