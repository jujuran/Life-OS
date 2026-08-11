# Architecture

## Product Goal

Build a personal-first operating system that starts with finance and can later connect:

- health
- growth
- work
- relationships
- reviews
- agents

The first shipping surface should still be finance, because it gives clear daily actions and measurable value.

## Recommended Architecture

### 1. Web-first product layer

`apps/web` should be the first real product surface.

Reason:

- desktop and mobile browsers can use it immediately
- it becomes the fastest place to validate workflows
- Gemini can help iterate layout and visual quality here first

This is based on Next.js App Router being a full-stack React framework with file-based routing and modern server/client patterns in the official docs.

Source:

- https://nextjs.org/docs/app
- https://nextjs.org/docs

### 2. Separate API / BFF layer

`apps/api` should hold:

- auth
- use cases
- sync rules
- audit logs
- agent execution policies

Do not bury all business logic inside the web app.

Why:

- mobile will need the same business actions
- desktop local mode will still need shared rules
- agents must call stable use cases, not random UI handlers

### 3. Shared domain package

`packages/domain` should define:

- entities
- validation schemas
- domain events
- use-case contracts

Examples:

- `createTransaction`
- `updateBudget`
- `closeMonth`
- `generateMonthlyReport`
- `previewAgentAction`

This package is the real center of the product.

### 4. Database abstraction

`packages/db` should support two storage directions:

- cloud adapter: Postgres / Supabase
- local adapter: SQLite for stronger offline or private desktop mode later

Important inference:

If you truly want a serious local-only mode long-term, desktop plus SQLite is a better foundation than treating browser storage as the main ledger.

Official docs checked:

- Supabase provides Postgres, Auth, Storage, Realtime, and self-hosting documentation
- Tauri can wrap web frontends and add native desktop capability

Sources:

- https://supabase.com/docs
- https://supabase.com/docs/guides/database/overview
- https://supabase.com/docs/guides/realtime
- https://v2.tauri.app/start/

### 5. Desktop shell

`apps/desktop` should package the web app through Tauri once the product is stable enough.

Why Tauri fits this roadmap:

- official docs say it can use any web frontend
- it is designed for small, fast cross-platform apps
- it is suitable when you want native desktop capability without switching away from your web stack

Sources:

- https://v2.tauri.app/start/
- https://v2.tauri.app/start/create-project/

### 6. Native mobile

`apps/mobile` should be added after the finance workflows settle.

Expo is a good fit because its official docs position it as one JavaScript/TypeScript project that runs natively across devices.

Suggested role for the mobile app:

- quick transaction capture
- dashboard check
- reminders
- review snapshots

Not the place to invent a totally different product structure.

Source:

- https://docs.expo.dev/

## Module Boundaries

### apps/web

Owns:

- responsive product UI
- dashboard pages
- settings pages
- finance workflows

Does not own:

- long-term business rules
- direct agent execution policy

### apps/api

Owns:

- auth and user context
- domain orchestration
- report generation
- agent approval flow
- sync endpoints

### apps/desktop

Owns:

- local desktop shell
- native menus
- local file export/import
- stronger private mode later

### apps/mobile

Owns:

- native mobile experience
- quick capture flows
- notifications
- offline queue later

### packages/ui

Owns:

- design tokens
- layout primitives
- charts shell
- shared component patterns

### packages/domain

Owns:

- transaction model
- budget model
- report contracts
- agent-safe command definitions

### packages/db

Owns:

- schema
- migrations
- db adapters
- repositories

### packages/agents

Owns:

- capability registry
- tool schemas
- approval rules
- action preview and logging

## Finance MVP Surface

The first product release should cover:

- transaction create/edit/delete
- income and expense categories
- account list
- monthly budget
- monthly report
- yearly trend
- dashboard summary

This mirrors the useful parts of your Notion reference while moving into a real product architecture.

## What Not To Do First

- do not start with desktop-only
- do not start with native mobile-only
- do not let agents write to the database directly
- do not overbuild sync before the finance workflow is proven
- do not split the visual language across web and mobile too early
