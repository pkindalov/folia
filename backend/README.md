# Folia Backend

Express + MongoDB JSON API (MVC), adapted from ExpressJS-Skeleton-For-Projects. Auth uses JWT instead of sessions; handlebars views were removed since the frontend will be separate.

## Run with Docker (recommended)

From the `folia` root folder:

```bash
docker compose up -d --build
```

- API: http://localhost:1337
- MongoDB data persists in `D:\folia\mongo-data`
- Uploaded files persist in `D:\folia\uploads`

Containers can be stopped/removed freely — data stays on D:.

```bash
docker compose down        # stop (data kept)
docker compose logs -f api # watch logs
```

If MongoDB fails to start with the D: bind mount (a Docker Desktop on Windows limitation), switch to the named volume — see comments in `docker-compose.yml`.

## Run locally without Docker

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

Requires MongoDB on localhost:27017 (you can run just Mongo via `docker compose up -d mongo`).

## API

| Method | Route | Auth | Body |
|---|---|---|---|
| GET | /api/health | – | – |
| POST | /api/auth/register | – | `{ username, email, password }` |
| POST | /api/auth/login | – | `{ username, password }` |
| GET | /api/users/me | Bearer token | – |
| GET | /api/users/:username | Bearer token | – |

Register/login return `{ token, user }`. Send the token as `Authorization: Bearer <token>`.

A default `Admin` user is seeded on first run (password from `ADMIN_PASSWORD`, default `admin1234` — change it).

## Structure

```
backend/
  index.js                 entry point
  server/
    config/                settings, database, express, routes, auth (JWT)
    controllers/           home, users
    data/                  Mongoose models (User)
    utilities/             encryption, error-handler
```
