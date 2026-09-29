# GitHub Actions → VPS deploy

Deploys on every push to **`main`** (and manually via **Actions → Deploy to VPS → Run workflow**).

Target stack: **Docker Compose** ([DOCKER_VPS.md](./DOCKER_VPS.md)) — `postgres` + `api` + `web` (Nginx on port 80).

---

## 1. Create the GitHub repo

From your machine (with [GitHub CLI](https://cli.github.com/) logged in as [smarpuri123](https://github.com/smarpuri123)):

```bash
cd /path/to/AirconDuctOrder
git init -b main
git add -A
git commit -m "Initial commit"
gh repo create AirconDuctOrder --private --source=. --remote=origin --push
```

Use a public repo only if you are sure no secrets will ever be committed (`server/.env` must stay on the VPS only).

---

## 2. One-time VPS setup

Install **Docker** on the VPS ([DOCKER_VPS.md](./DOCKER_VPS.md) §1). Stop host **Nginx** if it uses port 80.

Clone **with deploy key or HTTPS** so `git pull` works:

```bash
sudo mkdir -p /var/www/ecovent
sudo chown "$USER:$USER" /var/www/ecovent
cd /var/www/ecovent
git clone git@github.com:smarpuri123/AirconDuctOrder.git .
```

Create on the server (not in git):

```bash
cp .env.docker.example .env.docker
nano .env.docker   # POSTGRES_PASSWORD, JWT_SECRET, CORS_ORIGIN, RUN_DB_SEED=true first time
```

First deploy:

```bash
chmod +x scripts/deploy-vps.sh
./scripts/deploy-vps.sh
# After login works, set RUN_DB_SEED=false in .env.docker and deploy again
```

---

## 3. GitHub repository secrets

In the repo: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Example | Required |
|--------|---------|----------|
| `VPS_HOST` | `94.136.190.140` | Yes |
| `VPS_USER` | `ubuntu` or your SSH user | Yes |
| `VPS_SSH_KEY` | Private key (PEM), full contents | Yes |
| `VPS_PORT` | `22` | No (defaults to 22) |
| `VPS_APP_DIR` | `/var/www/ecovent` | No (defaults to `/var/www/ecovent`) |

### SSH key for Actions

On your **local machine**:

```bash
ssh-keygen -t ed25519 -C "github-actions-ecovent" -f ./ecovent-deploy -N ""
```

- Add **`ecovent-deploy.pub`** to the VPS: `~/.ssh/authorized_keys` for `VPS_USER`
- Paste **`ecovent-deploy`** (private) into GitHub secret `VPS_SSH_KEY`

Test:

```bash
ssh -i ./ecovent-deploy user@94.136.190.140 "cd /var/www/ecovent && git status"
```

---

## 4. Optional: GitHub Environment

The workflow uses `environment: production`. In **Settings → Environments → production** you can:

- Require reviewers before deploy
- Re-use the same secrets at environment scope

---

## 5. What each deploy does

`scripts/deploy-vps.sh` on the VPS:

1. `git fetch` + `reset --hard origin/main`
2. `docker compose -f docker-compose.prod.yml --env-file .env.docker build`
3. `docker compose ... up -d`

---

## 6. Troubleshooting

| Symptom | Check |
|---------|--------|
| SSH fails in Actions | `VPS_HOST`, user, key, firewall (port 22), `authorized_keys` |
| `git fetch` fails on VPS | Deploy key on GitHub repo, or HTTPS token in git remote |
| Empty site after deploy | `npm run build` logs; `dist/index.html` exists |
| API 502 | `docker compose ... logs api`; check `.env.docker` |
| Port 80 in use | Stop host Nginx: `sudo systemctl stop nginx` |
| Login CORS errors | `CORS_ORIGIN` in `.env.docker` must match browser URL exactly |

CI workflow (`.github/workflows/ci.yml`) runs on PRs and `main` to verify builds before/after merge.
