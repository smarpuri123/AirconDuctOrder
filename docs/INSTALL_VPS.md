# One-command VPS install

Everything is in GitHub. On a **fresh Ubuntu VPS** (SSH as your user):

## Quick install

```bash
curl -fsSL https://raw.githubusercontent.com/smarpuri123/AirconDuctOrder/main/scripts/install-vps.sh | bash
```

First run may create `.env.docker` from the template and **stop** — edit secrets, then run again:

```bash
nano /var/www/ecovent/.env.docker
bash /var/www/ecovent/scripts/install-vps.sh
```

## Install with env vars (no manual nano)

```bash
export ECOVENT_CORS_ORIGIN=http://94.136.190.140
export ECOVENT_POSTGRES_PASSWORD='your-strong-db-password'
export ECOVENT_JWT_SECRET="$(openssl rand -base64 48)"
curl -fsSL https://raw.githubusercontent.com/smarpuri123/AirconDuctOrder/main/scripts/install-vps.sh | bash
```

## What the script does

1. Installs Docker + Compose (if missing)
2. Stops host Nginx if it uses port 80
3. Clones or updates `https://github.com/smarpuri123/AirconDuctOrder.git` in `/var/www/ecovent`
4. Creates `.env.docker` (template, `ECOVENT_*` vars, or `ENV_DOCKER_B64`)
5. Runs `scripts/deploy-vps.sh` (build + `docker compose up`)

## Bad Gateway (502) on login

Usually the **api** container is not running (often seed failed on first boot).

```bash
cd /var/www/ecovent
docker compose -f docker-compose.prod.yml --env-file .env.docker logs api --tail 80
```

After a successful first login, set `RUN_DB_SEED=false` in `.env.docker` and redeploy so the API starts faster.

## Updates later

```bash
bash /var/www/ecovent/scripts/install-vps.sh
```

Or push to `main` on GitHub with [GitHub Actions](./GITHUB_ACTIONS_VPS.md) configured.

## GitHub Actions secrets

| Secret | Purpose |
|--------|---------|
| `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` | SSH deploy |
| `ENV_DOCKER_B64` | Optional: create `.env.docker` on first deploy |

Details: [GITHUB_ACTIONS_VPS.md](./GITHUB_ACTIONS_VPS.md)

## More

- [DOCKER_VPS.md](./DOCKER_VPS.md) — stack overview, logs, backups
- Local dev: `npm run dev:all` (no Docker required except optional `npm run db:up`)
