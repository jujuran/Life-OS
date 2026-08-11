# packages/db

Data access and schema layer.

Expected contents:

- schema definitions
- migrations
- repository interfaces
- postgres adapter
- sqlite adapter later

Keep the business meaning in `packages/domain`, not in SQL files alone.

## Current finance surface

Implemented first:

- `src/finance-repository.ts`
  - dashboard read contract
  - ledger write/read contract
  - structured entry persistence contract
