# Gemini UI Collaboration

## Best Split Of Work

Gemini is a good partner for:

- dashboard visual directions
- card hierarchy
- icon and color suggestions
- empty states
- onboarding wording
- mobile layout variants
- chart presentation ideas

Codex should own:

- architecture
- component wiring
- shared design token structure
- form state and validation
- data model integration
- accessibility
- responsive implementation
- agent-safe action flows

## Good Workflow

1. define page goal here
2. ask Gemini for layout and visual directions
3. lock the chosen direction
4. implement it in the shared UI system
5. review behavior on desktop and mobile

## Prompt Template For Gemini

Use this structure:

```text
You are helping design a personal finance dashboard for a long-term personal operating system.

Page:
Finance dashboard

Primary user:
Single-user creator managing personal income, expenses, budgets, and monthly review

Goals:
- record a transaction in under 10 seconds
- understand this month's status in under 30 seconds
- feel calm, premium, and personal

Required modules:
- monthly income
- monthly expense
- budget progress
- category breakdown
- latest transactions
- trend chart
- quick add action

Constraints:
- must work on desktop and mobile
- avoid generic SaaS visuals
- support future expansion into a broader life system

Please output:
- page structure
- component list
- visual direction
- spacing and typography guidance
- mobile adaptation notes
```

## What To Bring Back From Gemini

When you use Gemini for UI work, bring back:

- layout sketch
- component names
- spacing rules
- typography direction
- color tokens
- desktop/mobile differences

Then implement those inside `packages/ui`, not ad hoc inside one page.

## Warning

Do not let Gemini define the data model or API contract from the UI alone.

That part needs to stay tied to the domain layer.
