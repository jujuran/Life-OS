# packages/domain

Shared business language.

Expected contents:

- entities
- value objects
- zod schemas
- domain services
- command and query contracts

This package should be used by web, api, mobile, desktop, and agents.

## Current finance surface

Implemented first:

- `src/finance-model.ts`
  - finance dashboard view model
  - capture draft and parse contracts
  - ledger-entry creation helper
  - recent-flow creation helper
  - registry/category consistency helpers
