# Overview

The Design System is a Vite/React single-page application with a separately started Node API. The browser uses React Router and lazy-loaded feature views; the API uses Hono and `@hono/node-server`.

## Main entrypoints

- `src/main.tsx` mounts the browser app.
- `src/app/router.tsx` declares public application routes under `AppShell`.
- `src/server/api/index.ts` mounts authenticated API route groups and health endpoints.
- `src/server/api/db.ts` creates Drizzle clients for the Design database and, when configured, a Prospector connection.

The API authenticates `/api/*` routes after the auth router, adds request IDs and security headers, and closes database pools on `SIGTERM`. The browser client sends credentials and request IDs through `src/lib/api/client.ts`.

The two products still use separate PostgreSQL databases in production. Consolidation into the editorial database is a future migration described by the top-level plan.
