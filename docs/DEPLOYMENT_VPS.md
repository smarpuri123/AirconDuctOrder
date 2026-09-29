# ECOVENT — VPS deployment (IP only) & dispatch APK

**Production URL:** `http://94.136.190.140` (no domain).

Stack: React/Vite admin + mobile routes (`/m/*`), Fastify API, PostgreSQL, uploads in `server/uploads/`.

---

## 1. IP-only: what works and what does not

| Feature | On `http://94.136.190.140` | Notes |
|---------|---------------------------|--------|
| Admin portal in desktop browser | Yes | Full API mode |
| Mobile UI in phone browser (`/m`) | Yes | Use Chrome; bookmark home screen (shortcut only) |
| **PWA install** + service worker | **No / limited** | Browsers require HTTPS (except `localhost`) |
| **Web Push** on mobile | **No** | Needs HTTPS + VAPID |
| **Dispatch test APK** | **Yes** | Use Capacitor + allow HTTP to your IP |
| Let’s Encrypt TLS on bare IP | No | Use HTTP or self-signed HTTPS (see appendix) |

**Practical choice for dispatchers:** ship a **debug/release APK** (Capacitor) pointing at `http://94.136.190.140/api`. Office staff use the **same IP** in a desktop browser for admin.

---

## 2. Architecture (HTTP on port 80)

```
Internet
   │
   ▼
Nginx :80  ──► /         → /var/www/ecovent/dist
           ├── /api/*   → proxy → 127.0.0.1:3001
           └── /ws      → WebSocket → 127.0.0.1:3001

PostgreSQL :5432 (127.0.0.1 only)
PM2 → server/dist/index.js
```

| URL | Purpose |
|-----|---------|
| `http://94.136.190.140/` | Admin portal |
| `http://94.136.190.140/login` | Admin login |
| `http://94.136.190.140/m/login` | Mobile dispatch UI (browser) |
| `http://94.136.190.140/api/health` | API health |

---

## 3. VPS preparation (Ubuntu 22.04/24.04)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx postgresql postgresql-contrib ufw git

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw enable
```

No Certbot required for IP-only HTTP.

### PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE USER ecovent WITH PASSWORD 'REPLACE_STRONG_PASSWORD';
CREATE DATABASE ecovent_ops OWNER ecovent;
SQL
```

---

## 4. Deploy application

### 4.1 Clone

```bash
sudo mkdir -p /var/www/ecovent
sudo chown $USER:$USER /var/www/ecovent
cd /var/www/ecovent
git clone <your-repo-url> .
```

### 4.2 `server/.env`

```env
DATABASE_URL=postgresql://ecovent:REPLACE_STRONG_PASSWORD@localhost:5432/ecovent_ops?schema=public
JWT_SECRET=<openssl rand -base64 48>
JWT_EXPIRES_IN=7d
PORT=3001
HOST=0.0.0.0
NODE_ENV=production
CORS_ORIGIN=http://94.136.190.140
```

`CORS_ORIGIN` must match exactly how users open the site (scheme + host, no trailing slash). If you later add a port in the URL, include it (e.g. `http://94.136.190.140:8080`).

### 4.3 Database + API

```bash
cd /var/www/ecovent/server
npm ci
npx prisma generate
npx prisma db push
npm run db:seed          # login users + org (no demo clients)
npx tsx prisma/backfill-business-sequences.ts
npm run build
pm2 start dist/index.js --name ecovent-api
pm2 save
pm2 startup
```

### 4.4 Frontend build (same origin `/api`)

```bash
cd /var/www/ecovent
npm ci
```

`.env.production`:

```env
VITE_USE_API=true
VITE_API_URL=/api
```

```bash
npm run build
```

---

## 5. Nginx (IP only, HTTP)

`/etc/nginx/sites-available/ecovent`:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name 94.136.190.140;

    root /var/www/ecovent/dist;
    index index.html;

    client_max_body_size 55m;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://127.0.0.1:3001/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/ecovent /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

## 6. Post-deploy checks

```bash
curl -s http://94.136.190.140/api/health
# {"status":"ok","service":"ecovent-api"}
```

| Test | URL / user |
|------|------------|
| Admin | `http://94.136.190.140/login` — `admin` / `Admin@123` |
| Dispatch (browser) | `http://94.136.190.140/m/login` — `dispatch` / `Dispatch@123` |
| Create dispatch | Mobile flow end-to-end |

Change all seeded passwords before wider use.

---

## 7. Updates

**Automated (recommended):** push to `main` on GitHub — see [GITHUB_ACTIONS_VPS.md](./GITHUB_ACTIONS_VPS.md).

**Manual:**

```bash
cd /var/www/ecovent
./scripts/deploy-vps.sh
```

Or step-by-step:

```bash
cd /var/www/ecovent
git pull
cd server && npm ci && npx prisma db push && npm run build && pm2 restart ecovent-api
cd .. && npm ci && npm run build
```

---

## 8. Mobile dispatch on IP — use an APK (not PWA install)

### Option A — Phone browser (quick)

Open `http://94.136.190.140/m/login` in Chrome → optional **Add to Home screen** (shortcut; not a full offline PWA).

### Option B — Capacitor APK (recommended for field test)

Build on a dev machine with Android SDK.

**1. Install Capacitor (once, in repo root)**

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "ECOVENT Dispatch" com.ecovent.dispatch --web-dir dist
```

**2. `capacitor.config.ts` — live server (easiest updates)**

```ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ecovent.dispatch',
  appName: 'ECOVENT Dispatch',
  webDir: 'dist',
  server: {
    url: 'http://94.136.190.140/m',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
}
export default config
```

Web UI loads from the VPS; no rebuild needed for most UI changes. Phone must reach `94.136.190.140` on the network (Wi‑Fi / mobile data if VPS is public).

**3. Allow HTTP in Android** — `android/app/src/main/AndroidManifest.xml` inside `<application>`:

```xml
android:usesCleartextTraffic="true"
```

**4. API URL for bundled builds (alternative)**

If you bundle assets instead of `server.url`:

```env
VITE_USE_API=true
VITE_API_URL=http://94.136.190.140/api
npm run build
npx cap sync android
```

**5. Build debug APK**

```bash
npx cap add android   # first time only
npx cap sync android
cd android && ./gradlew assembleDebug
```

APK path: `android/app/build/outputs/apk/debug/app-debug.apk`

Share APK securely; testers enable **Install unknown apps** for your file manager or Chrome.

#### APK checklist (IP)

- [ ] Phone on network that can reach `94.136.190.140`
- [ ] Login as dispatch user
- [ ] Orders and dispatches load
- [ ] Create trip; quantities enforced
- [ ] Status buttons advance one step at a time

---

## 9. Environment matrix (IP)

| Target | `VITE_USE_API` | `VITE_API_URL` | `CORS_ORIGIN` |
|--------|----------------|----------------|---------------|
| VPS browser | `true` | `/api` | `http://94.136.190.140` |
| Capacitor live URL | (server loads site) | — | `http://94.136.190.140` |
| Capacitor bundled | `true` | `http://94.136.190.140/api` | `http://94.136.190.140` |

---

## 10. Security (IP / HTTP)

HTTP sends JWT and passwords in cleartext on the network. Acceptable only for **closed VPN / trusted LAN** or short UAT. Mitigations:

- Strong `JWT_SECRET`, rotate seeded passwords
- SSH key-only, `ufw` (22 + 80 only)
- Postgres not exposed publicly
- Plan HTTPS later if you add a domain

---

## 11. Backups

| Asset | Method |
|-------|--------|
| DB | `pg_dump` cron → off-server |
| `server/uploads/` | rsync / snapshot |
| Secrets | not in git |

---

## Appendix A — Optional self-signed HTTPS on IP

Only if you need TLS experiments (not required for admin HTTP UAT):

```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/ecovent-ip.key \
  -out /etc/ssl/certs/ecovent-ip.crt \
  -subj "/CN=94.136.190.140"
```

Add `listen 443 ssl` to Nginx with those paths. Browsers will warn; users must accept manually. PWA may still be picky—**APK remains the better dispatch channel on IP-only**.

---

## Appendix B — If you add a domain later

Switch `CORS_ORIGIN`, rebuild frontend, enable Let’s Encrypt, set `VITE_API_URL=/api`, and prefer HTTPS PWA or TWA.

---

## Related

- [LOCAL_DEV.md](../LOCAL_DEV.md)
- [MOBILE_DISPATCH.md](../MOBILE_DISPATCH.md)
