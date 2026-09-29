# Docker on VPS (production)

**One command:** see **[INSTALL_VPS.md](./INSTALL_VPS.md)** (`scripts/install-vps.sh`).

**Local development** stays direct: `npm run dev:all` and optional `npm run db:up` (Postgres only in `docker-compose.yml`).

**VPS** runs the full stack via `docker-compose.prod.yml`:

| Service | Role |
|---------|------|
| `postgres` | PostgreSQL 16 + persistent volume |
| `api` | Fastify API (Prisma, uploads volume) |
| `web` | Nginx — static React build + proxy `/api` and `/ws` |

Port **80** is published by the `web` container. Stop host Nginx if it already uses port 80:

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
```

---

## 1. Install Docker on Ubuntu

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker "$USER"
# log out and back in so docker runs without sudo
```

---

## 2. Clone app

```bash
sudo mkdir -p /var/www/ecovent
sudo chown "$USER:$USER" /var/www/ecovent
cd /var/www/ecovent
git clone https://github.com/smarpuri123/AirconDuctOrder.git .
```

---

## 3. Environment file (not in Git)

Git only contains **`.env.docker.example`**. You create **`.env.docker`** on the VPS (or via GitHub secret `ENV_DOCKER_B64` — see [GITHUB_ACTIONS_VPS.md](./GITHUB_ACTIONS_VPS.md) §3).

```bash
cp .env.docker.example .env.docker
nano .env.docker
chmod 600 .env.docker
```

Set at minimum:

- `POSTGRES_PASSWORD` — strong password
- `JWT_SECRET` — `openssl rand -base64 48`
- `CORS_ORIGIN` — `http://YOUR_VPS_IP` (exact browser URL)
- `RUN_DB_SEED=true` — **first deploy only**, then set to `false` and redeploy

---

## 4. First start

```bash
chmod +x scripts/deploy-vps.sh
./scripts/deploy-vps.sh
```

Or manually:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d --build
```

---

## 5. Checks

```bash
curl -s http://YOUR_VPS_IP/api/health
```

Browser: `http://YOUR_VPS_IP/login` — `admin` / `admin@123` (change after UAT).

---

## 6. Updates (GitHub Actions or manual)

```bash
cd /var/www/ecovent
./scripts/deploy-vps.sh
```

---

## 7. Useful commands

```bash
ENV="docker compose -f docker-compose.prod.yml --env-file .env.docker"

$ENV logs -f api
$ENV exec api npx tsx prisma/seed.ts
$ENV exec postgres pg_dump -U ecovent ecovent_ops > backup.sql
```

Data volumes: `ecovent_pg_data`, `ecovent_uploads`.

---

## Related

- [GITHUB_ACTIONS_VPS.md](./GITHUB_ACTIONS_VPS.md) — CI deploy (uses `deploy-vps.sh`)
- [DEPLOYMENT_VPS.md](./DEPLOYMENT_VPS.md) — legacy bare-metal notes (PM2/Nginx on host)
