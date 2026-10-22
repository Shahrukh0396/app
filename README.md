# Scanflow

Scanflow is a document-scanner platform in this repository: a NestJS API, a Next.js admin portal, and a React Native app. The existing Barrio 24 app remains in `frontend/` and `backend/` and is not part of the pnpm workspace.

## Prerequisites

- Node.js 22 or newer
- pnpm 10.33.4 (`corepack enable && corepack prepare pnpm@10.33.4 --activate`)
- PostgreSQL 16 and Redis 7 for the API
- Docker, only if you start the stack with Compose
- Xcode for the iOS app, and the Android SDK for the Android app

## Environment

```bash
cp .env.example .env
cp apps/mobile/.env.example apps/mobile/.env
```

Fill in JWT secrets before running the API. R2, OAuth, RevenueCat, and SMTP stay empty until those services are configured. OAuth and RevenueCat receipt validation return HTTP 503 when their client ids or API keys are missing. The demo user is created only when `SEED_DEMO=true`.

## Install

```bash
pnpm install
pnpm --filter @scanflow/api exec prisma generate
```

`pnpm install` builds `@scanflow/types`.

## Database

With `DATABASE_URL` pointing at PostgreSQL:

```bash
pnpm db:migrate
pnpm db:seed
```

`pnpm db:migrate` runs `prisma migrate deploy`. `pnpm db:seed` inserts `demo@scanflow.app` only when `SEED_DEMO=true`.

## API and admin

```bash
pnpm --filter @scanflow/api start:dev
pnpm --filter @scanflow/admin dev
```

The API listens on port 3000. The admin app listens on port 3001 and signs in through `POST /auth/login` with an admin user.

## Mobile

```bash
pnpm --filter @scanflow/mobile start
pnpm --filter @scanflow/mobile android
pnpm --filter @scanflow/mobile ios
```

`SCANFLOW_API_URL` in `apps/mobile/.env` defaults to `http://10.0.2.2:3000` for the Android emulator. The iOS and Android projects are the React Native 0.88 CLI app in `apps/mobile`. A native build was not run in this environment.

## Tests

These commands were run in this workspace:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

API end-to-end tests in `apps/api/test/app.e2e-spec.ts` run only when both `DATABASE_URL` and `SCANFLOW_E2E=1` are set. Otherwise Jest skips that file and the unit tests still run. CI sets both and runs `prisma migrate deploy` against PostgreSQL and Redis service containers.

## Docker Compose

`docker compose up --build` is the intended way to start Postgres, Redis, the API, the admin app, and nginx. Nginx publishes port 8080, proxies `/api/` to the API, and proxies `/` to the admin app. This environment does not have the Docker CLI, so that command was not executed here.

```bash
docker compose up --build
```

A PostgreSQL custom-format dump is `infra/backup/backup.sh`. It reads `DATABASE_URL` and was not executed here because `pg_dump` is not installed.
