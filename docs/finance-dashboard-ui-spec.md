# Finance System Home UI Spec

Phase: `Phase 1`

Status: `Locked for first implementation`

Theme: `The Editor`

## Goal

The finance system home should feel:

- calm
- minimal
- typographic
- low-noise
- agent-ready

It should allow:

- recording a transaction in under 10 seconds
- understanding this month's status in under 30 seconds
- checking account balances in under 20 seconds
- checking savings and investment position in under 30 seconds

## Core Visual Direction

### Primary Direction

`The Editor`

Characteristics:

- near-borderless layout
- typography drives hierarchy
- black, white, and gray only
- large whitespace
- restrained emphasis

Why this direction is adopted:

- lowest long-term visual fatigue
- highest information density without chaos
- easiest to keep consistent across web, desktop, and mobile
- safest base for future agent overlays and inline suggestions

### Reserved Alternate

`The Journal`

Do not implement this in Phase 1.

It can be revisited later if the interface feels too cold.

## Information Architecture

Order the finance home from highest-value action to deeper analysis:

1. Global navigation
2. Capture composer
3. Financial overview
4. Fund accounts
5. Budget monitoring
6. Liability overview
7. Action queue
8. Income insight
9. Cash-flow insight
10. Net-asset snapshot
11. Investment overview
12. Recent flows

### Module Breakdown

| Module | Priority | Contents |
| --- | --- | --- |
| Global navigation | L1 | month switcher, year/month context, settings entry |
| Capture composer | L1 | structured quick entry first, natural-language assist second, explicit income / expense / transfer selection |
| Financial overview | L2 | monthly expense, monthly income, current balance, net assets |
| Fund accounts | L2 | spendable cash, wallets, bank accounts, savings balances |
| Budget monitoring | L3 | total budget, used amount, progress, alert status |
| Liability overview | L3 | credit cards, due amount, bill date, due date, total liabilities |
| Action queue | L3 | upcoming repayments, transfers to execute, manual checks, reminders |
| Income insight | L3 | income source ranking, recent income context, receiving accounts |
| Cash-flow insight | L3 | income bars, expense bars, and balance line in one chart; transfers excluded |
| Net-asset snapshot | L3 | month-level net-asset change, compact long-term trend, latest delta |
| Investment overview | L3 | investment assets, floating profit/loss, holdings list |
| Recent flows | L4 | latest 5-10 entries across expense, income, and transfer |

## Desktop Layout

Use when viewport width is greater than `1024px`.

### Container

- `max-width: 1024px`
- horizontal centering
- `padding-inline: 32px`

### Grid

- 12-column mental model
- lower content area split as `8 / 4`
- large horizontal breathing room

### Section Order

1. header row
2. capture composer
3. financial overview row
4. two-column finance body

### Desktop Wireframe Rules

| Area | Width | Notes |
| --- | --- | --- |
| Header | full width | month selector left, settings right |
| Capture composer | full width | sits directly under header |
| Overview row | full width | hero finance metrics |
| Main column | 66% | fund accounts, cash-flow trend, net-asset snapshot, recent flows |
| Side column | 33% | budget, liabilities, action queue, income sources, investment panel, payment-channel mix |

### Main Column

Contains:

- financial overview row
- fund-account balances
- cash-flow trend block
- net-asset snapshot block
- recent flows block

### Side Column

Contains:

- budget block
- liability overview
- action queue
- income insight
- investment overview
- payment-channel block

## Mobile Layout

Use when viewport width is below `768px`.

### Container

- `width: 100%`
- `padding-inline: 16px`

### Layout Strategy

- single column
- top-to-bottom waterfall
- bottom fixed capture entry

### Section Order

1. top bar
2. finance overview hero
3. fund accounts
4. liability overview
5. budget summary
6. action queue
7. income insight
8. cash-flow trend
9. net-asset snapshot
10. investment overview
11. category ranking and payment-channel mix
12. recent flows
13. capture composer

### Mobile Wireframe Rules

| Area | Behavior | Notes |
| --- | --- | --- |
| Top bar | sticky optional | month selector and settings |
| Finance hero | full width | main monthly view with income, balance, and net assets |
| Fund accounts | full width | compact rows of major cash and savings accounts |
| Liability block | full width | credit cards and due amount summary |
| Budget block | full width | compact horizontal progress |
| Action queue | full width | compact reminders and due items |
| Income block | full width | source ranking and receiving account hints |
| Cash-flow trend | full width | income above zero, expense below zero, balance as thin line |
| Net-asset snapshot | full width | compact monthly long-term view |
| Investment block | full width | summary plus holdings list |
| Category / channel blocks | full width | stacked ranked rows |
| Recent flows | full width | infinite scroll ready |
| Capture composer | full width | structured quick entry remains visible on mobile |

## Capture Composer

This is the main capture surface and the future bridge to external agents.

### Purpose

- fast capture
- lower typing burden
- explicit income / expense / transfer confirmation
- explicit category and account or channel confirmation
- future command surface for assisted actions

### Mode Strategy

Use two modes:

- `Quick Entry`: default mode, structured and selectable
- `Natural Language`: helper mode, parses and prefills quick entry

### Quick Entry Fields

- direction: income / expense / transfer
- amount
- category
- payment channel or receiving account
- source account and destination account for transfers
- note
- channel and account options should support user-managed custom additions

### Natural Language Examples

- `打车 45 钱包 A`
- `午饭 28 餐饮 钱包 B`
- `工资 12000 银行卡 A`
- `副业 1800 钱包 A`
- `退款 89 钱包 B`
- `钱包 B 提现 500 银行卡 A`
- `银行卡 A 转 信用账户 A 3280`

### Interaction Flow

| Step | State | User Action | UI Response |
| --- | --- | --- | --- |
| 1 | Default | idle | quick-entry mode is active with default selects |
| 2 | Select | choose income, expense, or transfer | category options and labels update |
| 3 | Fill | enter amount and optional note | save button becomes primary action |
| 4 | Assist | switch to natural-language mode | parser suggests direction, category, and channel or source/target accounts |
| 5 | Confirm | accept prefills from parser | values are copied into quick-entry mode |
| 6 | Success | submit quick entry | form resets, success feedback appears, list inserts new row |
| 7 | Error | invalid amount or missing fields | inline error text appears without silent misclassification |

### Phase 1 Scope

Phase 1 capture should support:

- amount
- note
- explicit direction selection
- explicit category selection
- explicit channel selection
- conditional transfer source / destination selection
- configurable channel and account registry
- natural-language prefill assistance
- inferred direction only as a suggestion, not the final source of truth

Phase 1 does not need bank sync, autonomous reconciliation, or multi-command parsing.

## Component Inventory

### `CommandInput`

Responsibilities:

- quick-entry layout orchestration
- natural-language assist mode
- parser preview
- prefill into structured entry
- submit state
- helper hint area

### `QuickEntryForm`

Responsibilities:

- explicit direction selection including transfer
- explicit category selection
- explicit channel selection
- explicit source and target accounts for transfers
- add custom channel or account into current registry
- amount entry
- note entry
- submit validation

### `MetricCard`

Responsibilities:

- label
- primary number
- optional delta or supporting number

### `AccountBalanceList`

Responsibilities:

- account label
- current balance
- account type
- optional spendable marker

### `LiabilityList`

Responsibilities:

- liability account label
- due amount
- bill and due dates
- total liability summary

### `ActionQueue`

Responsibilities:

- due items
- reminder labels
- suggested source account
- optional scheduled amount

### `IncomeSourceList`

Responsibilities:

- ranked income sources
- amount display
- receiving account or channel hint
- active month comparison

### `BudgetProgress`

Responsibilities:

- planned amount
- used amount
- progress line
- alert state over threshold

### `CashFlowTrendChart`

Responsibilities:

- combined income / expense / balance display
- income above baseline, expense below baseline
- balance rendered as a restrained thin line
- transfer records excluded from the chart
- optional tooltip
- no heavy axis UI

### `NetAssetSnapshot`

Responsibilities:

- compact month-over-month net-asset display
- current net-assets and latest delta
- long-term direction without noisy detail

### `BarList`

Responsibilities:

- ranked categories
- amount display
- horizontal proportional bars

### `InvestmentPanel`

Responsibilities:

- total investment assets
- floating profit or loss
- holdings list
- investment type summary

### `TransactionRow`

Responsibilities:

- date
- category icon or abbreviation
- label
- income / expense / transfer direction
- payment channel or receiving account
- optional source and destination pair for transfers
- amount
- optional note

## Component State Rules

| Component | Default | Hover | Focus / Active | Empty / Loading / Alert |
| --- | --- | --- | --- | --- |
| Transaction list | text-only rows | row bg `#F9F9F9` | row bg `#F0F0F0` | empty placeholder, skeleton loading |
| Section blocks | no heavy chrome | no special hover needed | none | content skeleton or faded placeholder |
| Budget progress | black thin line | none | none | red when over threshold |
| Chart data | default svg stroke and bar fill | black tooltip with white text | point highlight optional | text fallback when empty |

## Design Tokens

### Color

| Token | Value | Usage |
| --- | --- | --- |
| `--bg-canvas` | `#FFFFFF` | page background |
| `--bg-muted` | `#FBFBFB` | subtle surfaces only when needed |
| `--text-primary` | `#111111` | primary text and numbers |
| `--text-secondary` | `#767676` | labels and secondary info |
| `--text-tertiary` | `#B3B3B3` | placeholders and disabled states |
| `--border-light` | `#EBEBEB` | dividers and subtle rules |
| `--accent-alert` | `#E05A47` | budget alert, negative stress state |

### Spacing

| Token | Value | Usage |
| --- | --- | --- |
| `--space-4` | `4px` | micro spacing |
| `--space-8` | `8px` | row spacing |
| `--space-16` | `16px` | internal group spacing |
| `--space-32` | `32px` | mobile block gap |
| `--space-64` | `64px` | desktop major block gap |

### Radius

| Token | Value | Usage |
| --- | --- | --- |
| `--radius-sm` | `6px` | compact interactive elements |
| `--radius-md` | `12px` | subtle surface rounding when needed |

## Typography

### Font Strategy

- numbers: `Geist Mono`, `SF Mono`, fallback mono
- body: `system-ui`, `-apple-system`, sans-serif
- all numbers should use `font-variant-numeric: tabular-nums`

### Type Scale

| Token | Value | Usage |
| --- | --- | --- |
| `.text-hero` | `32px / 1.2 / 600 / mono` | monthly expense hero number |
| `.text-h2` | `16px / 1.5 / 500 / sans` | block title |
| `.text-body` | `14px / 1.5 / 400 / sans` | standard text |
| `.text-label` | `12px / 1.5 / 400 / sans` | weak labels and timestamps |

## Icons

### Recommendation

- `Lucide`
- or `Phosphor Light`

### Rules

- line icons only
- fixed stroke feel
- no multi-color icons
- category icons should remain secondary to text

## Charts

### Recommendation

- lightweight custom svg or Recharts

### Rules

- the primary finance chart should be `cash-flow trend`, not a spend-only sparkline
- use positive bars for income and negative bars for expense
- use one thin line for balance
- transfer and internal account moves should not appear in this chart
- keep axes extremely restrained; a baseline is enough in Phase 1
- no grid-heavy chart chrome
- stroke width `1.5px`
- line color `#111111`
- no colorful pie charts
- category breakdown should use ranked bars, not pie slices
- account and investment allocation should also prefer ranked bars or lists
- show net-asset change separately as a compact monthly snapshot, not mixed into cash-flow bars

## Motion

Keep motion minimal and purposeful.

Allowed:

- subtle fade on success feedback
- shake on input error
- low-intensity skeleton shimmer

Avoid:

- bouncing cards
- exaggerated hover lifts
- decorative transitions without meaning

## Empty / Loading / Alert States

### Empty

- keep layout intact
- show short neutral placeholder text

Suggested copy:

- `暂无记录。`
- `尚无本月数据。`

### Loading

- prefer skeletons over spinners
- reduce opacity of placeholder metrics

### Alert

- never flood the interface with red
- only alert the progress line and key number

Suggested copy:

- `预算已达上限。`
- `已超出本月预算 ¥500`

## Tone of Voice

The product should sound like a calm, precise personal operator.

Avoid:

- cheerleading language
- panic language
- generic SaaS copy

Prefer:

- short phrases
- neutral guidance
- restrained clarity

Examples:

| Situation | Avoid | Prefer |
| --- | --- | --- |
| input placeholder | `请输入账单金额、时间、类别...` | `记一笔...` |
| over budget | `警告！您已严重超支！` | `预算已达上限。` |
| empty transactions | `暂无数据！快去记账吧！` | `暂无记录。` |
| month label | `2023年10月份财务统计报表` | `10月 / Oct.` |

## Implementation Notes

This spec is approved as the Phase 1 UI basis for `apps/web`.

What remains flexible:

- exact chart library
- exact icon package
- whether metric modules are rendered as true cards or section blocks
- exact density of accounts and holdings

What should stay fixed:

- overall hierarchy
- The Editor visual tone
- low-noise layout
- super input as primary action
- desktop and mobile ordering
- finance-system scope beyond pure bookkeeping
