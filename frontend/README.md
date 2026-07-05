# Folia Frontend

React + TypeScript (Vite) with TanStack Query, React Router, React Hook Form and Zod. Styled with Tailwind CSS v4 using design tokens from the `../design` HTML exports (see also `../DESIGN.md`).

## Routes

| Route | Page | Auth |
|---|---|---|
| `/` | Landing (redirects to `/flipbooks` when signed in) | – |
| `/login`, `/register` | Auth pages | – |
| `/flipbooks` | My Flipbooks gallery | ✓ |
| `/explore` | Community albums | ✓ |
| `/archive` | Archived volumes shelf | ✓ |
| `/editor`, `/editor/:id` | Creation workspace | ✓ |
| `/book/:id` | Interactive flipbook viewer | ✓ |

Pages beyond auth use mock data (`features/*/mock.ts`) shaped like future API responses — swap the mocks for TanStack Query calls once the backend endpoints exist.

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

## Tests

Vitest + React Testing Library, colocated with each feature (`*.test.ts(x)` next to the code). `fetch` is mocked — no backend needed.

```bash
npm test           # run all tests
npm run test:watch # watch mode
```

Coverage: zod schemas (boundaries mirroring backend rules), API client (headers, token, error mapping), auth service (token storage, zod response guards), FormField accessibility, ProtectedRoute redirects, and full user flows on the Login/Register/Home pages (validation, API errors, success navigation).

## Commands

```bash
npm run dev      # dev server with HMR
npm run build    # type-check + production build (dist/)
npm run lint     # lint
npm test         # run tests
```
