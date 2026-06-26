# Deploying Frappe HR on Railway

Railway deploys each service individually — there's no `--compose` flag.
Follow these steps to set up the three services (MariaDB, Redis, App) in one project.

---

## 1. Create the Railway project

Go to [railway.app](https://railway.app) → **New Project** → **Empty Project**.

---

## 2. Add MariaDB (custom Docker service)

1. Click **+ New Service** → **Docker Image**
2. Image: `mariadb:10.11`
3. Go to the service **Variables** tab and add:
   ```
   MYSQL_ROOT_PASSWORD=your-strong-password
   ```
4. Go to **Settings** → **Networking** → enable the private network (so other services can reach it as `mariadb.railway.internal`).
5. Go to **Volumes** → add a volume mounted at `/var/lib/mysql`.

---

## 3. Add Redis (custom Docker service)

1. Click **+ New Service** → **Docker Image**
2. Image: `redis:7-alpine`
3. No environment variables needed.
4. Optionally add a volume at `/data` for persistence.

---

## 4. Add the HRMS app

1. Click **+ New Service** → **GitHub Repo**
2. Select `kamesh231/hrms-frappe`, branch `claude/zen-maxwell-2bwh73`.
3. Railway will auto-detect the `Dockerfile` at the root.

### Set environment variables (Variables tab)

```
DB_HOST=mariadb.railway.internal
DB_PORT=3306
DB_ROOT_PASSWORD=your-strong-password
DB_NAME=hrmsdb

REDIS_CACHE_URL=redis://redis.railway.internal:6379
REDIS_QUEUE_URL=redis://redis.railway.internal:6379
REDIS_SOCKETIO_URL=redis://redis.railway.internal:6379

SITE_NAME=hrms.localhost
ADMIN_PASSWORD=your-admin-password

FRAPPE_BRANCH=version-17
ERPNEXT_BRANCH=version-17
HRMS_BRANCH=main
HRMS_REPO=https://github.com/kamesh231/hrms-frappe.git
```

> Use `mariadb.railway.internal` and `redis.railway.internal` — these are
> Railway's private DNS names for services within the same project.

4. Go to **Volumes** → add a volume mounted at `/home/frappe/frappe-bench`.
5. **Deploy**.

---

## 5. Wait for first-run initialization

The first deploy takes **15–20 minutes**. The startup script will:
- Download and initialize the Frappe bench
- Install ERPNext and HRMS apps
- Create the database site

Watch logs in the Railway dashboard. You'll see `==> [start] Starting bench...` when it's ready.

---

## 6. Access the app

Go to the HRMS service → **Settings** → **Networking** → **Generate Domain**.
Open the generated URL — you'll reach the Frappe login screen.

- Username: `Administrator`
- Password: the `ADMIN_PASSWORD` you set above
