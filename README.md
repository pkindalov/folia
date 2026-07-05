# Folia

A digital platform for creating and sharing tactile, heritage-inspired digital flipbooks.

> Work in progress — backend is up, frontend not started yet. See `DESIGN.md` for the design system and `design/` for HTML mockups.

## Project structure

```
folia/
  backend/            Express + MongoDB JSON API (MVC) — see backend/README.md
  design/             HTML design mockups (desktop + mobile)
  DESIGN.md           Design system (typography, colors, tokens)
  docker-compose.yml  Runs API + MongoDB
```

## Run the backend (Docker — recommended)

Prerequisite: Docker Desktop installed and running.

**Step 1 — Clone the repo**

```bash
git clone <repo-url>
cd folia
```

**Step 2 — Create your `.env` file** (in the folia root, next to `docker-compose.yml`)

```env
JWT_SECRET=put-a-long-random-string-here
```

Generate a good secret with: `openssl rand -hex 32` (or any long random string). This file is gitignored — every dev creates their own, never commit it.

**Step 3 — Check the data folders** in `docker-compose.yml`

Database and uploads are stored on the host in `D:/folia/mongo-data` and `D:/folia/uploads`. If you don't have a `D:` drive, change these two volume paths to a folder that exists on your machine. Docker creates the folders automatically on first run.

**Step 4 — Build and start**

```bash
docker compose up -d --build
```

**Step 5 — Verify it works**

```bash
docker compose ps                        # both containers "running"
curl http://localhost:1337/api/health    # expect "db":"connected"
```

If something fails, check `docker compose logs api` and `docker compose logs mongo`.

- API: http://localhost:1337
- MongoDB data persists in `D:\folia\mongo-data`
- Uploads persist in `D:\folia\uploads`

Stopping or removing containers does NOT delete data:

```bash
docker compose down          # stop everything, keep data
docker compose logs -f api   # watch API logs
docker compose up -d --build # rebuild after code changes
```

## Run the backend without Docker

Requires Node 18+ and MongoDB on localhost:27017 (or run just Mongo: `docker compose up -d mongo`).

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

## Quick API test

```bash
curl http://localhost:1337/api/health
curl -X POST http://localhost:1337/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"pan\",\"email\":\"pan@test.com\",\"password\":\"secret123\"}"
```

Full endpoint list: `backend/README.md`.

## Before going public

- Set a strong `JWT_SECRET` (env var or `.env`)
- Change the seeded Admin password (`ADMIN_PASSWORD`, default `admin1234`)
