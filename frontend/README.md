# Folia Frontend

React + TypeScript (Vite) with TanStack Query, React Router, React Hook Form and Zod. Styled with CSS Modules using the tokens from `../DESIGN.md`.

## Run

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Opens on http://localhost:5173. The backend must be running (see root README) and its `.env` should contain `CORS_ORIGIN=http://localhost:5173`.

## What is included

- Login / register pages wired to the backend API (`/api/auth/*`)
- Protected home page fetching the current user (`/api/users/me`)
- JWT stored in localStorage, sent as `Authorization: Bearer`
- All API responses validated with Zod before use

## Structure

Feature-based: each feature owns its api, schemas, hooks, components and pages, and exposes a public API through its `index.ts`. Cross-feature imports go through that index only.

```
src/
  app/                  App shell (routes)
  lib/                  shared infrastructure (fetch client, token storage)
  components/           shared feature-agnostic UI (FormField)
  features/
    auth/
      api.ts            login/register/me service (zod-validated)
      schemas.ts        zod schemas + inferred types
      hooks.ts          useMe, useLogin, useRegister, useLogout
      components/       ProtectedRoute
      pages/            LoginPage, RegisterPage (+ CSS Modules)
      index.ts          public API of the feature
    flipbooks/
      pages/            HomePage (placeholder)
      index.ts
```

Adding a new feature: create `src/features/<name>/` with the same shape and export its public surface from `index.ts`.

## Commands

```bash
npm run dev      # dev server with HMR
npm run build    # type-check + production build (dist/)
npm run lint     # eslint
```
