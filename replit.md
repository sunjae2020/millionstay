# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

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

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Property Admin (`artifacts/property-admin`)
- **Kind**: web (React + Vite)
- **Port**: 23339
- **Purpose**: Internal admin tool for managing rental property listings
- **Tech**: React, Vite, wouter, shadcn/ui, TanStack Query, react-hook-form

**Sections:**
1. **Dashboard** — summary stat cards + pending approval alert
2. **Suburbs** — CRUD with search, country/state filters
3. **Properties** — CRUD with approval status workflow (Pending → Active)
4. **Space Options** — amenity tag CRUD
5. **Space Policies** — house rules templates (boolean Yes/No radio fields)
6. **Spaces** — most complex, tabbed form with lookup fields + 30-day availability calendar

**Components:**
- `StatusBadge` — colored badge for Active/Pending/Suspended/Rejected
- `LookupField` — single-select modal lookup (dialog-based)
- `MultiLookupField` — multi-select modal lookup with tag display
- `Layout` + `PageHeader` — sidebar nav + page header

### API Server (`artifacts/api-server`)
- **Kind**: api
- **Port**: 8080
- **Routes**: `/api/v1/suburbs`, `/api/v1/properties`, `/api/v1/space-options`, `/api/v1/space-policies`, `/api/v1/spaces`, `/api/v1/spaces/:id/availability`

## Database Schema (`lib/db`)

Tables: `suburbs`, `properties`, `space_options`, `space_policies`, `spaces`, `space_option_maps`, `space_blocked_dates`

## API Client (`lib/api-client-react`)

Generated from OpenAPI spec via Orval. Hooks: `useListSuburbs`, `useGetSuburb`, `useCreateSuburb`, `useUpdateSuburb`, `useDeleteSuburb`, etc. for all 5 entities plus `useGetSpaceAvailability` and `useBlockSpaceAvailability`.
