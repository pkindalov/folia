# Folia

A digital platform for creating and sharing tactile, heritage-inspired digital flipbooks.

> Work in progress — backend is up, frontend not started yet. See `DESIGN.md` for the design system and `design/` for HTML mockups.

## Project structure

```
folia/
  backend/            Express + MongoDB JSON API (MVC) — see backend/README.md
  frontend/           React + TypeScript (Vite) — see frontend/README.md
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
ADMIN_PASSWORD=pick-your-admin-password
```

Generate a good secret with: `openssl rand -hex 32` (or any long random string). `ADMIN_PASSWORD` becomes the password of the seeded `Admin` account — without it, no admin is created. This file is gitignored — every dev creates their own, never commit it.

**Step 3 — Check the data folders** in `docker-compose.yml`

Database and uploads are stored on the host in `D:/folia/mongo-data` and `D:/folia/uploads`. If you don't have a `D:` drive, change these two volume paths to a folder that exists on your machine. Docker creates the folders automatically on first run.

**Step 4 — Build and start** (make sure Docker Desktop is running first)

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

## Run the frontend (dev)

Backend must be running first. Add `CORS_ORIGIN=http://localhost:5173` to the root `.env` (and restart: `docker compose up -d`).

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Open http://localhost:5173 — register an account and you land on the (placeholder) home page. Details in `frontend/README.md`.

## Quick API test

```bash
curl http://localhost:1337/api/health
curl -X POST http://localhost:1337/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"pan\",\"email\":\"pan@test.com\",\"password\":\"secret123\"}"
```

Full endpoint list: `backend/README.md`.

## Troubleshooting

- **Forgot/never knew the admin password?** Set `ADMIN_PASSWORD` in `.env`, then run: `docker compose up -d && docker compose exec api npm run set-admin-password`
- **`docker compose` can't connect to Docker?** Start Docker Desktop and wait for "running" in the tray.

## Security notes

- `JWT_SECRET` is required — compose refuses to start without it in `.env`
- `ADMIN_PASSWORD` controls the seeded `Admin` account; reset anytime with `set-admin-password` (see above)
- Set `CORS_ORIGIN` to your frontend URL once it exists (default allows all origins)
