# Agent Integration

## Goal

Make the system ready for replaceable external agents without letting them become a hidden source of broken data.

## Rule 1

Agents must never write to the database directly.

They should only call approved use cases such as:

- `createTransaction`
- `categorizeTransaction`
- `suggestBudgetAdjustments`
- `draftMonthlyReview`
- `linkExpenseToProject`

## Rule 2

Every agent action should support preview before commit.

That means an agent flow should look like:

1. propose
2. preview
3. approve
4. execute
5. log

## Rule 3

All agent actions must be auditable.

Minimum log fields:

- `id`
- `provider`
- `agentName`
- `requestedAction`
- `inputPayload`
- `previewPayload`
- `approvedBy`
- `executedAt`
- `resultSummary`

## Recommended Package Shape

`packages/agents` should eventually contain:

- `capabilities/`
- `policies/`
- `providers/`
- `schemas/`
- `logs/`

## Provider Strategy

Do not hard-wire the system to one agent vendor.

Instead, define an internal adapter contract:

- `listCapabilities()`
- `previewAction()`
- `executeAction()`
- `describeRisk()`

Then create provider-specific adapters later:

- OpenAI-compatible adapter
- local agent adapter
- custom HTTP adapter
- internal automation adapter

## High-trust vs Low-trust Actions

### Low-trust

Can be auto-approved later:

- draft a monthly summary
- suggest categories
- suggest tags
- generate dashboard copy

### High-trust

Must require approval:

- create transaction
- edit amount
- delete transaction
- update budget
- close month
- export personal data

## Why This Matters

If the system becomes agent-aware too early without guardrails, your data stops being reliable.

For a life system, reliable data matters more than flashy automation.
