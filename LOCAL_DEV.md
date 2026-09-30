# Local Development Setup

Gets ECOVENT Operations running on your **Windows dev machine** without Docker.
Uses the same native PostgreSQL 18 instance as [pvsresponse](../pvsresponse/LOCAL_DEV.md)
(port **5433** on this machine — SQL Server uses 5432).

---

## Quick start

```
project root  → React portal     http://localhost:5173
server/       → Fastify API      http://localhost:3001
```

Demo mode (no backend): leave `VITE_USE_API=false` in `.env`.

API mode: set `VITE_USE_API=true` after database setup below.

---

## 1. PostgreSQL (already installed)

This project shares the Postgres Windows service from your other local projects.

Verify it is running:

```powershell
Get-Service postgresql*
# postgresql-x64-18 → Running
```

Confirm the port (5433 on this machine):

```powershell
Select-String "^port" "C:\Program Files\PostgreSQL\18\data\postgresql.conf"
```

`psql` path if not on PATH:

```
C:\Program Files\PostgreSQL\18\bin\psql.exe
```

---

## 2. Create the ECOVENT database and user

**Automated (recommended):**

```powershell
cd D:\coding\AirconDuctOrder
$env:PGPASSWORD="novaerp"   # postgres superuser password from install
npm run db:setup -- -PostgresPort 5433 -SkipInstall
```

**Manual (psql as postgres):**

```powershell
psql -U postgres -p 5433
```

```sql
CREATE USER ecovent WITH PASSWORD 'ecovent_dev';
CREATE DATABASE ecovent_ops OWNER ecovent;
\q
```

Then apply schema and seed:

```powershell
cd server
npm run db:generate
npm run db:push
npm run db:seed          # users, roles, org only (no demo clients)
```

---

## 3. Configure environment

```powershell
copy .env.example .env
copy server\.env.example server\.env
```

Root `.env` — enable API mode:

```ini
VITE_USE_API=true
VITE_API_URL=/api
```

`server/.env` — default for this machine:

```ini
DATABASE_URL=postgresql://ecovent:ecovent_dev@localhost:5433/ecovent_ops?schema=public
JWT_SECRET=change-this-to-a-long-random-secret-in-production
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

---

## 4. Start the app

```powershell
# Both frontend + API
npm run dev:all
```

Or in two terminals:

```powershell
npm run dev              # portal :5173
npm run dev:server       # API    :3001
```

Sign in at http://localhost:5173/login

| Username | Password |
|----------|----------|
| admin | Admin@123 |
| office | Office@123 |
| dispatch | Dispatch@123 |
| accounts | Accounts@123 |

Sign-in uses **username** (not email). Pasting `admin@ecovent.com` still works — the domain is stripped server-side.

**Existing database:** after pulling this change, run once:

```powershell
cd server
npx prisma db execute --file prisma/migrate-add-username.sql --schema prisma/schema.prisma
npx prisma db push
npm run db:seed          # users, roles, org only (no demo clients)
```

---

## Useful commands

```powershell
npm run db:push          # sync Prisma schema to DB
npm run db:seed          # users, roles, org only (no demo clients)
npm run db:seed:demo     # optional sample clients and orders
npm run db:init          # push + seed
cd server && npm run db:studio   # Prisma Studio
```

---

## Troubleshooting

**`P1001: Can't reach database server`**

```powershell
Start-Service postgresql-x64-18
```

Check port in `DATABASE_URL` matches `postgresql.conf` (5433 here, not 5432).

**`password authentication failed for user "postgres"`**

Use the superuser password set during PostgreSQL install (e.g. `novaerp`).

**`role "ecovent" does not exist`**

Run `npm run db:setup -- -PostgresPort 5433 -SkipInstall`.

**Port conflict with pvsresponse**

Both projects can run on the same Postgres instance — `novaerp` and `ecovent_ops`
are separate databases. Only avoid running both apps on the same HTTP ports.

---

## Client PDF user guides

See **`docs/CLIENT_USER_GUIDE.md`**. Generate shareable PDFs:

```powershell
npm run dev:all
# other terminal:
npm run docs:all
```

Outputs: `docs/ECOVENT-Admin-Portal-Guide.pdf`, `docs/ECOVENT-Mobile-Dispatch-Guide.pdf`.

Production screenshots:

```powershell
$env:PDF_BASE_URL="http://94.136.190.140"
$env:PDF_LOGIN_USER="admin"
$env:PDF_LOGIN_PASSWORD="your-password"
npm run docs:all
```

---

## Mobile APK (ECOVENT Dispatch)

Debug installable APK for field dispatchers. The app loads the **live mobile UI** from your VPS (`http://94.136.190.140/m`), so API and UI stay in sync after server deploys (phone needs internet).

**Build (Windows, Android SDK required):**

```powershell
npm run cap:apk
```

APK output:

- `android\app\build\outputs\apk\debug\app-debug.apk`
- Convenience copy: `release\ECOVENT-Dispatch-debug.apk` (gitignored; copy after build)

**Different server:** set `CAPACITOR_SERVER_URL` (no trailing slash), then rebuild:

```powershell
$env:CAPACITOR_SERVER_URL="http://94.136.190.140"
npm run cap:apk
```

On the phone: enable **Install unknown apps** for the app you use to open the APK, then log in with your dispatch user.
