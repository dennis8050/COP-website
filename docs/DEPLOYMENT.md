# AWS deployment and GitHub Actions

## Bootstrap

Use AWS SSO/short-lived credentials locally. Create remote state first with Terraform:

```bash
cd terraform/bootstrap
terraform init
terraform plan -var='state_bucket_name=YOUR_UNIQUE_BUCKET' -out=bootstrap.tfplan
terraform apply bootstrap.tfplan
cd ../..
npm ci
npm run build
```

Bootstrap state initially remains local; protect/archive it, then migrate it to a separate key in the new state bucket. Every environment has an independent state key and RDS/Cognito deployment. Prefer separate AWS accounts for production and development.

## Environment

```bash
cd terraform
cp environments/dev/backend.hcl.example environments/dev/backend.hcl
cp environments/dev/terraform.tfvars.example environments/dev/terraform.tfvars
# Edit bucket, repository, email and region; never add passwords.
terraform init -backend-config=environments/dev/backend.hcl
terraform fmt -recursive
terraform validate
terraform plan -var-file=environments/dev/terraform.tfvars -out=dev.tfplan
terraform apply dev.tfplan
terraform output
```

When switching environments, use separate checkouts or `terraform init -reconfigure` with that environment's backend. Never reuse a dev plan for production. First deployment creates the account-wide GitHub OIDC provider. For staging/production set `github_oidc_provider_arn` to that provider’s ARN to avoid duplicate creation. Do not import an existing provider blindly.

Invoke migration before any signup:

```bash
aws lambda invoke --function-name YOUR_MIGRATION_FUNCTION migration-result.json
```

Check invocation FunctionError and result success; the deployment workflow does both. Migration uses a transaction and advisory lock and is idempotent. The migration Lambda has no public route.

Set frontend production build variables from outputs:

```bash
VITE_AUTH_MODE=cognito VITE_API_URL=YOUR_API_URL VITE_COGNITO_USER_POOL_ID=YOUR_POOL VITE_COGNITO_CLIENT_ID=YOUR_CLIENT npm run build -w frontend
aws s3 sync frontend/dist s3://YOUR_FRONTEND_BUCKET --delete
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION --paths '/*'
```

Use CloudFront’s HTTPS URL. Private S3 uses signed origin access, not a public website endpoint. CORS allows only that frontend origin. Custom domains require ACM and DNS configuration before setting frontend_origin; the default CloudFront hostname works immediately.

## First administrator

Register through the portal, verify the email, and confirm post-confirmation created its MEMBER profile. Promote exactly that verified Cognito sub using the private migration function’s administrative command (see below). Use the CLI with an identity permitted to invoke only the private maintenance Lambda:

```bash
aws lambda invoke --function-name YOUR_MIGRATION_FUNCTION --cli-binary-format raw-in-base64-out --payload '{"bootstrap_admin_sub":"YOUR_VERIFIED_COGNITO_SUB"}' bootstrap-result.json
```

The bootstrap command only succeeds if the account exists and no active ADMIN exists. Further role changes are through ADMIN user management. Never allow the browser to choose a registration role.

## GitHub configuration

Create `dev`, `staging`, `production` GitHub environments. Restrict deployment branches and require reviewers for production. GitHub environment approval is a repository setting and must be configured before production releases. OIDC trust matches your exact repository and environment subject. Do not store AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY.

Environment variables: AWS_REGION, AWS_DEPLOY_ROLE_ARN, AWS_TERRAFORM_ROLE_ARN, TF_STATE_BUCKET, ALARM_EMAIL, GITHUB_OIDC_PROVIDER_ARN, API_URL, COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, FRONTEND_BUCKET, CLOUDFRONT_DISTRIBUTION_ID, API_FUNCTION, MIGRATION_FUNCTION, PROVISION_FUNCTION, FOLLOWUP_FUNCTION. Review [the Peel Halton migration and SMS rollout guide](PEEL_HALTON_UPGRADE.md) before enabling anything. Get resource values from Terraform outputs. State bucket IAM permissions must include GetObject/PutObject on the state key and GetObject/PutObject/DeleteObject on its `.tflock`, plus ListBucket.

The app deployment role is provided by Terraform. A separate infrastructure role (also provisioned by Terraform) plans/applies infrastructure and must receive the state bucket/key permissions specified in its inputs. Apply the first infrastructure deployment through SSO because the OIDC roles do not exist yet.

Pushes and PRs run lint/tests/build, Terraform PR validation, and no AWS changes. Run Terraform workflow manually for an authenticated plan. Run Deploy manually after checks pass; enable apply_infrastructure only for reviewed infrastructure changes. GitHub environment approval gates all mutation. A fresh plan is applied in that approved job; it is not an independently approved immutable plan artifact, so review source/inputs before approving.

Deploy backend before frontend; migration must succeed first. After initial Terraform apply, configure output variables before running app deployment. Changing resource names requires updating those variables. Promote the same reviewed commit to staging/production.

## Rollback and recovery

Redeploy a known-good commit for code. Never automatically reverse schema migrations. S3 versioning preserves old frontend objects. Test RDS point-in-time restore into a new private instance and update Terraform/import state and Lambda configuration carefully. Production deletion protection and final snapshots prevent accidental database removal. Confirm SNS email subscriptions for alarms.
