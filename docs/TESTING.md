# Validation

```bash
npm ci
npm run lint
npm test
npm run build
terraform -chdir=terraform fmt -check -recursive
terraform -chdir=terraform init -backend=false
terraform -chdir=terraform validate
# With AWS credentials/state configured:
terraform -chdir=terraform plan -var-file=environments/dev/terraform.tfvars
```

Unit checks cover backend roles, validation, pagination, calculations and QR generation. Database integration tests run the PostgreSQL schema in PGlite (real PostgreSQL compiled to WASM) and route API requests through the shared handler. This does not replace live RDS integration testing. Frontend component tests verify loading/error states and labels.

Release acceptance: sign in as all four roles; create/update/soft-delete member; create service/ministry/event; check in manually; scan a member QR; retry duplicate; deactivate member and retry; view own history; export date-filtered CSV/PDF; rotate QR; change user role; logout/reset password; verify no backend stacks or credentials in responses. Repeat scanner checks on real phones over HTTPS. Test session expiry and direct unauthorized API calls. Verify audit records, no QR tokens in logs, backup restore and CloudWatch alarms.

AWS plan/apply, Cognito live email delivery and physical camera validation require your account/devices and are not proven by a local build.
