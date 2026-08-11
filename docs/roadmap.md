# Roadmap

## Phase 0

Current phase:

- define architecture
- define folder ownership
- define product boundaries

## Phase 1

Ship finance MVP on the web:

- dashboard
- add transaction
- ledger list
- monthly report
- yearly trend
- settings

## Phase 2

Add cloud backbone:

- auth
- Postgres schema
- sync API
- media and export support
- audit logs

## Phase 3

Add desktop shell:

- Tauri wrapper
- local export/import
- optional local database mode
- desktop notifications

## Phase 4

Add native mobile:

- quick capture
- summary views
- reminders
- safe offline queue

## Phase 5

Add agent layer:

- agent capability registry
- action preview
- approval flow
- execution logging
- provider adapters

## Build Sequence I Recommend

1. turn `apps/web` into a real project
2. define the finance domain in `packages/domain`
3. define db schema in `packages/db`
4. add `apps/api`
5. add desktop shell
6. add mobile
7. add agent integrations
