# Church Management & Attendance

The Church of Pentecost Canada – Peel Halton Area church portal for 200–1,000 members with PostgreSQL persistence, manual and camera QR attendance, Cognito authentication, role authorization, reports and modular AWS Terraform.

## Project structure

```text
church-management/
  frontend/src/{components,hooks,pages,services}
  backend/src/{api,auth,database,handler,local,migrate,provision,seed,validation}.ts
  backend/database/001_initial.sql
  backend/tests/
  terraform/{bootstrap,environments,modules}
  .github/workflows/{frontend,backend,terraform,deploy}.yml
  docs/{ARCHITECTURE,DEPLOYMENT,SECURITY,TESTING,TROUBLESHOOTING,COSTS}.md
```

The public page has mission/vision/values, configurable service times, events, ministries, contact details and a persistent contact form. The protected workspace provides CRUD, member search/filtering/pagination, QR camera check-in, manual attendance, CSV/PDF reports, role management, and church settings. Members view/download/print their QR and update permitted profile fields.

**Peel Halton Area upgrade:** Read [deployment and migration notes](docs/PEEL_HALTON_UPGRADE.md) before making any production changes. Seven district views, verified district-scoped backend access, attendance finalization, and a disabled-by-default SMS follow-up worker have been added. Existing records require an explicit district assignment; SMS requires additional provider/compliance setup before go-live.

Read [architecture](docs/ARCHITECTURE.md), [deployment](docs/DEPLOYMENT.md), [security](docs/SECURITY.md), [testing](docs/TESTING.md), [costs](docs/COSTS.md), and [troubleshooting](docs/TROUBLESHOOTING.md).

## Dependencies

Node.js 22+, npm, Docker Compose (or PostgreSQL 17), Terraform 1.10+ (CI uses 1.13.5), AWS CLI v2. React 19, Vite, Tailwind, React Router, Recharts, QRCode, html5-qrcode, Amplify, pg, zod, aws-jwt-verify and AWS SDK.

## Quick start without AWS or Docker

```bash
npm ci
npm run setup:local
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:5173. Sign in as `admin@example.test` and select **Peel PIWC** using the randomly generated `DEMO_PASSWORD` in backend/.env. Setup preserves existing .env files. Use PostgreSQL/Docker below when you want the same wire-protocol database as AWS.

## Local development

```bash
npm ci
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Set `LOCAL_DB_PASSWORD` in your shell to a strong local-only password. Put the same URL-encoded password in backend `DATABASE_URL`. Set `LOCAL_JWT_SECRET` to at least 32 random characters and `DEMO_PASSWORD` to at least 12 characters. No credentials are distributed with this repository.

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:5173. The API is http://localhost:3001. Login using `admin@example.test`, `pastor@example.test`, `staff1@example.test`, `staff2@example.test`, or `member1@example.test` with your DEMO_PASSWORD. Seeds create twenty fictional members, six ministries, service history, attendance and upcoming events. Seeds are development-only; running them repeatedly creates more service history. Local JWT sessions are memory-only and require login after refresh. Production uses Amplify’s Cognito refresh session handling. Local registration/reset deliberately use seeded accounts; Cognito implements verified signup/password reset in deployed environments.

```bash
npm run lint
npm test
npm run build
```

QR scanner: select a service, start camera and allow permission. Use the member portal’s QR download or the administrator member detail view. Camera permission requires localhost or HTTPS. To test from a phone, serve local development through a trusted HTTPS tunnel and set VITE_API_URL/CORS_ORIGIN accordingly; the local API binds loopback intentionally.

### Without Docker

For a small persistent local PostgreSQL runtime, set `DATABASE_URL=pglite://./.local-postgres` in backend/.env, then run migrate, seed and dev normally (skip Docker). This uses PostgreSQL compiled to WebAssembly and persists on disk, not fake API responses. It is development-only and serializes transactions; AWS always uses RDS via pg. Stop the local server before running migrations or seed so only one process owns the local directory.

## Configuration

Frontend `VITE_API_URL`, `VITE_AUTH_MODE`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID` are public build-time configuration. Never put secrets in `VITE_` variables. Backend local `.env` values are documented in `.env.example`; AWS uses `NODE_ENV=production`, `AUTH_MODE=cognito`, `DB_SECRET_ARN`, `DB_HOST`, `DB_NAME`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `CORS_ORIGIN`. Terraform supplies them. Production refuses DATABASE_URL/local auth. RDS TLS verifies the bundled AWS trust certificate; refresh `backend/certs/global-bundle.pem` from AWS’s official truststore during certificate maintenance.

## API

Success `{success:true,data:...}`; errors `{success:false,error:{code,message}}`. GET/PUT/DELETE return 200, POST 201; invalid requests 400, unauthenticated 401, forbidden 403, missing 404, conflicts 409, unexpected 500.

Routes: `/public/settings`, `/public/events`, `/public/ministries`, `POST /contact`; `/me`, `/me/profile`, `/me/attendance`; CRUD `/members`, `/services`, `/events`, `/ministries`; `/members/:id/attendance`; `POST /members/:id/qr` rotates QR; CRUD `/attendance`, `POST /attendance/scan`; `/dashboard`, `/reports/attendance`, `/reports/members`; `/users`, `/settings`. `/auth/login` is local only. Production registration/login/verification/reset go directly to Cognito via Amplify; passwords never transit the application Lambda. API Gateway delegates JWT verification to Lambda so public and protected routes share one REST proxy.

Search pages are server paginated (maximum 100). Reports are bounded at 10,000 rows; split date ranges for larger exports. Member profile history is bounded at 200 rows. Attendance percentage uses present check-ins divided by eligible active-member/service opportunities, while member profile percentage uses their recorded statuses. Current streak uses eligible services through today, treating unrecorded services as absent. Reports can include absent and excused manual records.

## Deployment

Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). No live AWS account is embedded or automatically provisioned. Terraform makes chargeable resources only when you apply your reviewed plan. GitHub uses OIDC; no long-lived access keys.

## Production release gates

Run the full test/build suite and Terraform fmt/init/validate. Run a plan against your actual AWS account, review it, apply in dev, run migration, create verified users, test every role and scanner on iOS/Android, then promote through staging. Configure GitHub production environment required reviewers before permitting production deployment. Perform backup restore and alert-delivery checks. See the checklists in docs.
