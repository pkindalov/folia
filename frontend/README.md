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

```
src/
  api/         fetch client + auth service (zod-validated)
  types/       zod schemas and inferred TS types
  hooks/       useAuth (TanStack Query hooks: useMe, useLogin, ...)
  components/  ProtectedRoute, FormField
  pages/       LoginPage, RegisterPage, HomePage (+ CSS Modules)
```

## Commands

```bash
npm run dev      # dev server with HMR
npm run build    # type-check + production build (dist/)
npm run lint     # eslint
```
