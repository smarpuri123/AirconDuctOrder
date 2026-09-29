#!/usr/bin/env bash
# One-shot VPS install / update — clone repo, Docker, env, compose up.
# Usage (on Ubuntu VPS):
#   curl -fsSL https://raw.githubusercontent.com/smarpuri123/AirconDuctOrder/main/scripts/install-vps.sh | bash
#
# Or with secrets inline (no .env.docker file on disk before run):
#   export ECOVENT_CORS_ORIGIN=http://YOUR_IP
#   export ECOVENT_POSTGRES_PASSWORD='strong-db-password'
#   export ECOVENT_JWT_SECRET="$(openssl rand -base64 48)"
#   curl -fsSL .../install-vps.sh | bash
#
# Optional: REPO_URL, APP_DIR, BRANCH, ENV_DOCKER_B64 (see docs/INSTALL_VPS.md)

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/smarpuri123/AirconDuctOrder.git}"
APP_DIR="${APP_DIR:-/var/www/ecovent}"
BRANCH="${BRANCH:-main}"
ENV_FILE="${ENV_FILE:-.env.docker}"

log() { echo "==> $*"; }

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command: $1" >&2
    exit 1
  fi
}

install_docker_if_needed() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker already installed"
    return
  fi

  log "Installing Docker (Ubuntu/Debian)"
  need_cmd sudo
  sudo apt-get update -qq
  sudo apt-get install -y ca-certificates curl
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  sudo usermod -aG docker "${USER}" || true
  log "Docker installed (log out/in if 'permission denied' on docker)"
}

free_port_80() {
  if command -v systemctl >/dev/null 2>&1; then
    if systemctl is-active --quiet nginx 2>/dev/null; then
      log "Stopping host nginx (Docker web container uses port 80)"
      sudo systemctl stop nginx || true
      sudo systemctl disable nginx || true
    fi
  fi
}

ensure_repo() {
  need_cmd git
  if [[ -d "${APP_DIR}/.git" ]]; then
    log "Updating ${APP_DIR}"
    cd "${APP_DIR}"
    git fetch origin "${BRANCH}"
    git reset --hard "origin/${BRANCH}"
    return
  fi

  log "Cloning ${REPO_URL} → ${APP_DIR}"
  sudo mkdir -p "${APP_DIR}"
  sudo chown "${USER}:${USER}" "${APP_DIR}"
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
  cd "${APP_DIR}"
}

write_env_from_exports() {
  if [[ -f "${ENV_FILE}" ]]; then
    return 0
  fi

  if [[ -n "${ENV_DOCKER_B64:-}" ]]; then
    log "Writing ${ENV_FILE} from ENV_DOCKER_B64"
    echo "${ENV_DOCKER_B64}" | base64 -d > "${ENV_FILE}"
    chmod 600 "${ENV_FILE}"
    return 0
  fi

  if [[ -n "${ECOVENT_CORS_ORIGIN:-}" && -n "${ECOVENT_POSTGRES_PASSWORD:-}" && -n "${ECOVENT_JWT_SECRET:-}" ]]; then
    log "Writing ${ENV_FILE} from ECOVENT_* environment variables"
    cat > "${ENV_FILE}" <<EOF
POSTGRES_PASSWORD=${ECOVENT_POSTGRES_PASSWORD}
JWT_SECRET=${ECOVENT_JWT_SECRET}
JWT_EXPIRES_IN=${ECOVENT_JWT_EXPIRES_IN:-7d}
CORS_ORIGIN=${ECOVENT_CORS_ORIGIN}
HTTP_PORT=${ECOVENT_HTTP_PORT:-80}
RUN_DB_SEED=${ECOVENT_RUN_DB_SEED:-true}
EOF
    chmod 600 "${ENV_FILE}"
    return 0
  fi

  if [[ -f .env.docker.example ]]; then
    log "Creating ${ENV_FILE} from template — you must edit secrets, then re-run this script"
    cp .env.docker.example "${ENV_FILE}"
    chmod 600 "${ENV_FILE}"
    cat >&2 <<'EOF'

Edit /var/www/ecovent/.env.docker:
  - POSTGRES_PASSWORD
  - JWT_SECRET  (openssl rand -base64 48)
  - CORS_ORIGIN (http://YOUR_VPS_IP, no trailing slash)
  - RUN_DB_SEED=true for first install only

Then run again:
  bash /var/www/ecovent/scripts/install-vps.sh

Or pass variables before curl:
  export ECOVENT_CORS_ORIGIN=http://YOUR_IP
  export ECOVENT_POSTGRES_PASSWORD='...'
  export ECOVENT_JWT_SECRET='...'
EOF
    exit 1
  fi

  echo "Cannot create ${ENV_FILE}" >&2
  exit 1
}

main() {
  install_docker_if_needed
  free_port_80
  ensure_repo
  write_env_from_exports
  export APP_DIR="${APP_DIR}"
  export ENV_FILE
  bash "${APP_DIR}/scripts/deploy-vps.sh"

  local origin="${ECOVENT_CORS_ORIGIN:-}"
  if [[ -z "${origin}" && -f "${APP_DIR}/${ENV_FILE}" ]]; then
    origin="$(grep -E '^CORS_ORIGIN=' "${APP_DIR}/${ENV_FILE}" | cut -d= -f2- || true)"
  fi

  log "Done."
  echo ""
  echo "  Health: curl -s ${origin:-http://YOUR_IP}/api/health"
  echo "  Login:  ${origin:-http://YOUR_IP}/login  (admin / admin@123 after seed)"
  echo "  Logs:   cd ${APP_DIR} && docker compose -f docker-compose.prod.yml --env-file .env.docker logs -f"
  echo ""
  echo "  After first successful login, set RUN_DB_SEED=false in .env.docker and run install-vps.sh again."
}

main "$@"
