# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

The main user-facing app is a Japanese earthquake monitoring dashboard at the root preview path. It displays a full-screen Japan map, recent earthquake history from P2PQuake, prefecture intensity coloring, epicenter markers, sound alerts, and EEW WebSocket status.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Map UI**: Leaflet + React Leaflet

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/earthquake-monitor run dev` — run the earthquake monitor web app

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
