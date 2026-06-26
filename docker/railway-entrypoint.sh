#!/bin/bash
# Railway entrypoint for Frappe HR
# Handles first-run bench init + site creation, then starts bench.
set -e

BENCH_DIR="/home/frappe/frappe-bench"
SITE_NAME="${SITE_NAME:-hrms.localhost}"

export PATH="${NVM_DIR}/versions/node/v${NODE_VERSION}/bin:${PATH}"

# ── 1. Initialize bench on first run ────────────────────────────────────────
if [ ! -d "${BENCH_DIR}/apps/frappe" ]; then
    echo "==> [init] First run detected — initializing bench..."
    bench init \
        --skip-redis-config-generation \
        --frappe-branch "${FRAPPE_BRANCH:-version-17}" \
        "${BENCH_DIR}"
fi

cd "${BENCH_DIR}"

# ── 2. Point bench at Railway-provided services ──────────────────────────────
echo "==> [config] Configuring external services..."
bench set-mariadb-host "${DB_HOST:?DB_HOST is required}"
bench set-redis-cache-host    "${REDIS_CACHE_URL:?REDIS_CACHE_URL is required}"
bench set-redis-queue-host    "${REDIS_QUEUE_URL:-${REDIS_CACHE_URL}}"
bench set-redis-socketio-host "${REDIS_SOCKETIO_URL:-${REDIS_CACHE_URL}}"

# ── 3. Wait for MariaDB ──────────────────────────────────────────────────────
echo "==> [db] Waiting for MariaDB at ${DB_HOST}:${DB_PORT:-3306}..."
until mysqladmin ping \
        -h "${DB_HOST}" \
        -P "${DB_PORT:-3306}" \
        -u root \
        -p"${DB_ROOT_PASSWORD:?DB_ROOT_PASSWORD is required}" \
        --silent 2>/dev/null; do
    sleep 3
done
echo "==> [db] MariaDB is ready."

# ── 4. Install apps if missing ───────────────────────────────────────────────
if [ ! -d "apps/erpnext" ]; then
    echo "==> [apps] Installing ERPNext..."
    bench get-app --branch "${ERPNEXT_BRANCH:-version-17}" erpnext
fi

if [ ! -d "apps/hrms" ]; then
    echo "==> [apps] Installing HRMS..."
    bench get-app hrms \
        "${HRMS_REPO:-https://github.com/kamesh231/hrms-frappe.git}" \
        --branch "${HRMS_BRANCH:-main}"
fi

# ── 5. Create site on first run ──────────────────────────────────────────────
if [ ! -d "sites/${SITE_NAME}" ]; then
    echo "==> [site] Creating site '${SITE_NAME}'..."
    bench new-site "${SITE_NAME}" \
        --mariadb-root-password "${DB_ROOT_PASSWORD}" \
        --admin-password       "${ADMIN_PASSWORD:-admin}" \
        --db-name              "${DB_NAME:-hrmsdb}" \
        --no-mariadb-socket

    bench --site "${SITE_NAME}" install-app erpnext
    bench --site "${SITE_NAME}" install-app hrms
    bench --site "${SITE_NAME}" enable-scheduler
    bench --site "${SITE_NAME}" set-config server_script_enabled 1
    bench use "${SITE_NAME}"
    echo "==> [site] Site created and apps installed."
fi

# ── 6. Strip local redis/watch from Procfile (using Railway Redis) ───────────
sed -i '/^redis/d'  Procfile
sed -i '/^watch/d'  Procfile

# ── 7. Start ─────────────────────────────────────────────────────────────────
echo "==> [start] Starting bench..."
exec bench start
