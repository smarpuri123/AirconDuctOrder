# Production deploy — Docker (canonical guide)

Use this document on the **VPS** before running any deploy commands. It records every path, env var, and setting used by this repo so you do not need `server/.env` or `DATABASE_URL` on the host shell.

**Stack:** `postgres` + `api` (Fastify/Prisma) + `web` (Nginx + React `dist`) via `docker-compose.prod.yml`.

---

## 1. Settings to remember (fill in once)

Copy this block to a private note (password manager / server wiki). **Do not commit filled values to Git.**

| Setting | Production value (this project) | Notes |
|--------|----------------------------------|--------|
| **VPS IP / site URL** | `http://94.136.190.140` | No trailing slash |
| **App directory** | `/var/www/ecovent` | Git clone + deploy scripts |
| **Git remote** | `https://github.com/smarpuri123/AirconDuctOrder.git` | Branch: `main` |
| **Compose file** | `docker-compose.prod.yml` | Repo root |
| **Env file (secrets)** | `/var/www/ecovent/.env.docker` | **Not in Git** — from `.env.docker.example` |
| **Template in Git** | `.env.docker.example` | Safe to commit |
| **Deploy script** | `/var/www/ecovent/scripts/deploy-vps.sh` | Pull + build + `up -d` |
| **Install / update script** | `/var/www/ecovent/scripts/install-vps.sh` | Docker install + clone + deploy |
| **Published HTTP port** | `80` (`HTTP_PORT` in `.env.docker`) | Host Nginx must be stopped |
| **API (internal)** | `http://127.0.0.1:3001` | Only inside Docker network |
| **Postgres (internal)** | `postgres:5432` / DB `ecovent_ops` / user `ecovent` | Not exposed on host by default |
| **DATABASE_URL** | Set **inside `api` container only** | Built from `POSTGRES_PASSWORD` in compose — **do not** run `npx prisma` on the host without exporting it |
| **Uploads** | Docker volume `ecovent_uploads` | API path `/app/uploads` |
| **DB data** | Docker volume `ecovent_pg_data` | Persists across redeploys |

### Required `.env.docker` variables

| Variable | Required | Example / rule |
|----------|----------|----------------|
| `POSTGRES_PASSWORD` | Yes | Strong password; used by Postgres + `DATABASE_URL` in `api` |
| `JWT_SECRET` | Yes | `openssl rand -base64 48` |
| `JWT_EXPIRES_IN` | No | Default `7d` |
| `CORS_ORIGIN` | Yes | **Exact** browser origin, e.g. `http://94.136.190.140` (no trailing `/`) |
| `HTTP_PORT` | No | Default `80` |
| `RUN_DB_SEED` | First deploy | `true` once, then **`false`** forever after first successful login |
| `VAPID_*` | No | Web Push; needs HTTPS in browsers |

### URLs after deploy

| Purpose | URL |
|---------|-----|
| Health | `http://94.136.190.140/api/health` → `{"status":"ok","service":"ecovent-api"}` |
| Admin login | `http://94.136.190.140/login` |
| Mobile UI | `http://94.136.190.140/m/login` |

### Default seeded users (change after UAT)

| User | Password | Role |
|------|----------|------|
| `admin` | `admin@123` | Admin |
| `designer` | `designer@123` | Designer |
| `accounts` | `accounts@123` | Accounts |
| `dispatch` | `Dispatch@123` | Dispatch |

Seeding runs only when `RUN_DB_SEED=true` and the API container starts (see `server/docker/server-entrypoint.sh`).

### GitHub Actions (optional auto-deploy)

| Secret | Value |
|--------|--------|
| `VPS_HOST` | `94.136.190.140` |
| `VPS_USER` | Your SSH user |
| `VPS_SSH_KEY` | Private deploy key |
| `VPS_APP_DIR` | `/var/www/ecovent` (default if omitted) |
| `ENV_DOCKER_B64` | Optional base64 of `.env.docker` for first-time file creation |

Details: [GITHUB_ACTIONS_VPS.md](./GITHUB_ACTIONS_VPS.md).

---

## 2. What happens on deploy (no host Prisma)

1. `git fetch` + `reset --hard origin/main`
2. `docker compose -f docker-compose.prod.yml --env-file .env.docker build`
3. `docker compose ... up -d`
4. On **api** start: `npx prisma db push` (+ seed if `RUN_DB_SEED=true`)

**Important:** If you see `Environment variable not found: DATABASE_URL` on the VPS, you ran Prisma **on the host** in `server/`. Use the commands in §5 instead, or redeploy with `./scripts/deploy-vps.sh`.

The Prisma warning about `package.json#prisma` is informational (Prisma 7); it does not block deploy.

---

## 3. First-time production install

SSH to the VPS as a user in the `docker` group.

### Option A — One script (recommended)

With secrets inline (no manual `.env.docker` edit):

```bash
export ECOVENT_CORS_ORIGIN=http://94.136.190.140
export ECOVENT_POSTGRES_PASSWORD='REPLACE_STRONG_DB_PASSWORD'
export ECOVENT_JWT_SECRET="$(openssl rand -base64 48)"
export ECOVENT_RUN_DB_SEED=true

curl -fsSL https://raw.githubusercontent.com/smarpuri123/AirconDuctOrder/main/scripts/install-vps.sh | bash
```

### Option B — Clone then configure

```bash
sudo mkdir -p /var/www/ecovent
sudo chown "$USER:$USER" /var/www/ecovent
cd /var/www/ecovent
git clone https://github.com/smarpuri123/AirconDuctOrder.git .

cp .env.docker.example .env.docker
chmod 600 .env.docker
nano .env.docker   # set POSTGRES_PASSWORD, JWT_SECRET, CORS_ORIGIN, RUN_DB_SEED=true

chmod +x scripts/deploy-vps.sh scripts/install-vps.sh
./scripts/deploy-vps.sh
```

### After first successful login

Edit `.env.docker`:

```env
RUN_DB_SEED=false
```

Redeploy:

```bash
cd /var/www/ecovent
bash scripts/deploy-vps.sh
```

---

## 4. Routine updates (after `git push` to `main`)

On the VPS:

```bash
cd /var/www/ecovent
bash scripts/deploy-vps.sh
```

Or full install script (also ensures Docker / repo):

```bash
bash /var/www/ecovent/scripts/install-vps.sh
```

**Tell portal users to log out and back in** after API/auth changes so JWTs refresh (e.g. `employeeId` for role-scoped enquiry lists).

---

## 5. Command reference (always use these paths)

Set once per SSH session:

```bash
export APP_DIR=/var/www/ecovent
export ENV_FILE=$APP_DIR/.env.docker
export DC="docker compose -f $APP_DIR/docker-compose.prod.yml --env-file $ENV_FILE"
cd "$APP_DIR"
```

| Task | Command |
|------|---------|
| Deploy (pull + build + up) | `bash scripts/deploy-vps.sh` (or `chmod +x scripts/deploy-vps.sh && ./scripts/deploy-vps.sh`) |
| Container status | `$DC ps` |
| API logs | `$DC logs -f api` |
| Web logs | `$DC logs -f web` |
| Health (from VPS) | `curl -s http://94.136.190.140/api/health` |
| **Prisma db push (correct)** | `$DC exec api npx prisma db push` |
| **Prisma / DB shell** | `$DC exec api sh` |
| Re-run seed (careful) | `$DC exec api npx tsx prisma/seed.ts` |
| Postgres backup | `$DC exec postgres pg_dump -U ecovent ecovent_ops > ~/ecovent_ops_$(date +%F).sql` |
| Restart API only | `$DC restart api` |
| Rebuild from scratch | `$DC build --no-cache && $DC up -d` |

**Do not** run `cd server && npx prisma …` on the host unless you create `server/.env` with `DATABASE_URL` pointing at Postgres (bare-metal legacy). Docker production does not need `server/.env`.

---

## 6. Troubleshooting

| Symptom | What to check |
|---------|----------------|
| `DATABASE_URL` not found | Host Prisma — use `$DC exec api npx prisma db push` or redeploy |
| 502 Bad Gateway | `$DC logs api --tail 100` — often seed failure or API crash |
| Login CORS error | `CORS_ORIGIN` in `.env.docker` must match browser URL exactly |
| Port 80 in use | `sudo systemctl stop nginx && sudo systemctl disable nginx` |
| Empty site | `$DC logs web`; ensure build succeeded in deploy logs |
| DB empty after redeploy | Volumes removed? `docker volume ls \| grep ecovent` |
| Permission denied on `docker` | `sudo usermod -aG docker $USER` then log out/in |

---

## 7. Related docs

| Doc | When to use |
|-----|-------------|
| [INSTALL_VPS.md](./INSTALL_VPS.md) | Short one-command install pointer |
| [DOCKER_VPS.md](./DOCKER_VPS.md) | Stack overview + volume names |
| [GITHUB_ACTIONS_VPS.md](./GITHUB_ACTIONS_VPS.md) | CI/CD secrets |
| [DEPLOYMENT_VPS.md](./DEPLOYMENT_VPS.md) | Legacy PM2 + host Nginx (not Docker) |
| [LOCAL_DEV.md](../LOCAL_DEV.md) | Developer machine |

---

## 8. Quick copy — production update checklist

- [ ] Code on `main` pushed to GitHub  
- [ ] SSH to VPS  
- [ ] `cd /var/www/ecovent`  
- [ ] `.env.docker` exists; `RUN_DB_SEED=false` (except first install)  
- [ ] `./scripts/deploy-vps.sh`  
- [ ] `curl -s http://94.136.190.140/api/health`  
- [ ] Smoke test login in browser  
