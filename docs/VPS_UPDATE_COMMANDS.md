# VPS Server Update Guide (`AirconDuctOrder` / ECOVENT)

## 1. VPS Server Paths & Details

| Item | Value |
|---|---|
| **VPS Folder (App Root)** | `/var/www/ecovent` |
| **Git Repository** | `https://github.com/smarpuri123/AirconDuctOrder.git` |
| **Git Branch** | `main` |
| **Production URL** | `http://94.136.190.140` |
| **Admin Portal** | `http://94.136.190.140/login` |
| **Mobile Dispatch Portal (PWA)** | `http://94.136.190.140/m/login` |
| **API Health Endpoint** | `http://94.136.190.140/api/health` |
| **Docker Compose File** | `/var/www/ecovent/docker-compose.prod.yml` |
| **Docker Env File** | `/var/www/ecovent/.env.docker` |

---

## 2. Quick Update on VPS (Recommended — Docker Production Stack)

SSH into your VPS (`ssh root@94.136.190.140` or your deploy user) and run:

```bash
cd /var/www/ecovent
bash scripts/deploy-vps.sh
```

### What `scripts/deploy-vps.sh` does automatically:
1. Navigates to `/var/www/ecovent`
2. Runs `git fetch origin main` and `git reset --hard origin/main`
3. Rebuilds the `api` and `web` Docker images (`docker compose -f docker-compose.prod.yml --env-file .env.docker build`)
4. Restarts the updated containers (`docker compose -f docker-compose.prod.yml --env-file .env.docker up -d`)
5. Runs `npx prisma db push` inside the `api` container on startup

---

## 3. Manual Step-by-Step Docker Commands (Alternative)

If you prefer running each step manually on the VPS:

```bash
# 1. Go to the VPS project folder
cd /var/www/ecovent

# 2. Pull the latest code from GitHub (main branch)
git fetch origin main
git reset --hard origin/main

# 3. Rebuild and restart containers
docker compose -f docker-compose.prod.yml --env-file .env.docker build
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d

# 4. Apply any Prisma schema changes inside the API container (if needed)
docker compose -f docker-compose.prod.yml --env-file .env.docker exec api npx prisma db push

# 5. Check container status & health
docker compose -f docker-compose.prod.yml --env-file .env.docker ps
curl -s http://94.136.190.140/api/health
```

---

## 4. Helpful VPS Maintenance & Log Commands

```bash
cd /var/www/ecovent
export DC="docker compose -f /var/www/ecovent/docker-compose.prod.yml --env-file /var/www/ecovent/.env.docker"

# View live API logs
$DC logs -f api

# View live Web (Nginx) logs
$DC logs -f web

# Restart API container only
$DC restart api

# Backup PostgreSQL database
$DC exec postgres pg_dump -U ecovent ecovent_ops > ~/ecovent_ops_$(date +%F).sql
```

---

## 5. Legacy Bare-Metal Update Commands (Only if using PM2 + Host Nginx instead of Docker)

If your VPS is running bare-metal Node/PM2 + Nginx instead of Docker:

```bash
# 1. Go to project folder and pull latest changes
cd /var/www/ecovent
git fetch origin main
git reset --hard origin/main

# 2. Update & build Backend API
cd /var/www/ecovent/server
npm ci
npx prisma generate
npx prisma db push
npm run build
pm2 restart ecovent-api

# 3. Update & build Frontend Web + Mobile PWA
cd /var/www/ecovent
npm ci
npm run build
sudo systemctl reload nginx
```
