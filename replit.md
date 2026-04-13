# Workspace

## Overview

This pnpm workspace monorepo, built with TypeScript, provides a comprehensive property management SaaS solution called MillionStay. It includes an admin portal, a guest-facing booking portal, and dedicated portals for property agents and owners. The project aims to streamline property management operations, enhance guest experience, and provide specialized interfaces for various stakeholders.

## User Preferences

- I prefer clear and concise communication.
- Focus on high-level architecture and key features.
- Provide practical examples where appropriate.
- When suggesting code changes, explain the reasoning and potential impact.
- Prioritize well-structured and maintainable code.
- Always ask for confirmation before implementing significant architectural changes or adding new external dependencies.

## System Architecture

The project utilizes a pnpm workspace monorepo structure, with each package managing its own dependencies. Node.js 24 and TypeScript 5.9 are used across the board. The API is built with Express 5, backed by PostgreSQL and Drizzle ORM for database interactions. Zod is used for validation, and Orval generates API client code from an OpenAPI specification. Bundling is handled by esbuild.

**UI/UX Decisions:**

- **Property Admin:** A multi-module property management SaaS admin tool built with React and Vite. It features various dashboards (Overview, Reservations, Finance, Operations) with KPI stat cards, charts (recharts), and tables. It includes comprehensive CRUD interfaces for property management, CRM, sales, booking, products, contracts, finance, and maintenance modules. Custom components like `StatusBadge`, `LookupField`, `LookupSelect`, and `MultiLookupField` are used for consistent UI elements. The admin panel supports internationalization for EN, KO, ZH, JA, and TH.
- **MillionStay Guest Portal:** A guest-facing booking portal built with React and Vite, featuring a brand color of `#E8621A` (orange). It supports i18n (EN/JA/KO/ZH) and uses Zustand for state management. Pages include Home, Search (with Leaflet map), Space Detail, Booking flow, and user portals for bookings, invoices, and documents.
- **Partner Portals (Agent, Owner & Service Host):** Separate React + Vite web applications providing tailored views for agents, property owners, and service providers. The Agent Portal allows agents to view bookings, managed properties, and commissions. The Owner Portal enables owners to monitor property occupancy and revenue, with privacy masking for tenant names. The Service Host Portal lets cleaners, pickup drivers and similar service providers view assigned jobs, their schedule, and earnings.
- **Service Host Portal (port 21888, /service-host-portal):** Dashboard, My Jobs, Schedule, Earnings pages. Demo: `host@millionstay.com.au` / `Host@2026!`. `portal_type = service_host` in partner_users. Jobs sourced from `booking_services` where `service_id` matches `service_hosts.id` linked to the partner's `account_id`.

**Technical Implementations:**

- **API Server:** An Express-based API server handling all backend logic. Routes are versioned under `/api/v1/`. Lookup endpoints consistently return `{ id, display }` objects.
- **Database Schema:** A PostgreSQL database managed by Drizzle ORM, with 30 tables covering all aspects of property, booking, finance, and user management. Key tables include `accommodation_catalog` (unified product management), `cs_tickets` and `cs_messages` for customer support, and `partner_users` for agent/owner authentication.
- **Authentication:** JWT-based authentication for guests, admins, and partners. Partner authentication (`PARTNER_JWT_SECRET`) is handled separately and requires careful routing order in Express to prevent conflicts with admin authentication.
- **API Client:** Generated from an OpenAPI specification using Orval, providing React hooks and Zod schemas for type-safe API interactions.
- **Internationalization:** Implemented using `react-i18next` with locale files for multiple languages. Language preference is persisted in `localStorage`.
- **Key Patterns:** Consistent lookup endpoint formats (`{ id, display, ...extra }`), `enrichXxx()` server-side functions for data enrichment, FSM transitions via dedicated POST endpoints, and standardized reference formats (e.g., `MS-WO-YYYY-NNNNN`). Zod schemas from `@workspace/api-zod` are preferred for validation.

## External Dependencies

- **pnpm:** Monorepo package manager.
- **Node.js:** Runtime environment (version 24).
- **TypeScript:** Programming language (version 5.9).
- **Express:** Web application framework (version 5).
- **PostgreSQL:** Relational database.
- **Drizzle ORM:** TypeScript ORM for PostgreSQL.
- **Zod:** Schema declaration and validation library (v4).
- **Orval:** OpenAPI client code generator.
- **esbuild:** JavaScript bundler.
- **React:** JavaScript library for building user interfaces.
- **Vite:** Next-generation frontend tooling.
- **react-i18next:** Internationalization framework for React.
- **Zustand:** Small, fast, and scalable bearbones state-management solution.
- **Leaflet:** JavaScript library for interactive maps (used in Guest Portal search).
- **Recharts:** Composable charting library built with React and D3 (used in Admin Finance Dashboard).
- **Cloudinary:** Cloud-based image and video management service (for CS ticket image uploads).