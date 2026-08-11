# Finance System Home Implementation Plan

This document translates the approved UI spec into implementation work for `apps/web`.

## Phase 1 Output

Build one responsive route first:

- `/finance`

This route should render:

- desktop finance-system layout
- mobile finance-system layout
- static placeholder data first
- clear component boundaries for later real data wiring

## Route Structure

Suggested initial route tree:

- `app/finance/page.tsx`
- `app/finance/loading.tsx`
- `app/finance/error.tsx`

## Component Breakdown

Implement these components first:

1. `FinanceDashboardShell`
2. `FinanceHeader`
3. `CaptureComposer`
4. `QuickEntryForm`
5. `FinancialOverview`
6. `AccountBalanceList`
7. `BudgetProgress`
8. `LiabilityList`
9. `ActionQueue`
10. `IncomeSourceList`
11. `InvestmentPanel`
12. `CashFlowTrendChart`
13. `NetAssetSnapshot`
14. `CategoryBarList`
15. `ChannelFlowList`
16. `RecentTransactionsList`
17. `TransactionRow`

## Shared UI Ownership

These pieces should move into `packages/ui` once stable:

- typography tokens
- page container
- section heading
- divider
- progress bar
- list row primitives

## Data Contract For Mock Stage

Use a mock view model like this before wiring real APIs:

```ts
type FinanceDashboardViewModel = {
  periodLabel: string;
  expenseTotal: number;
  incomeTotal: number;
  balanceTotal: number;
  totalAssets: number;
  totalLiabilities: number;
  netAssets: number;
  budgetUsed: number;
  budgetTotal: number;
  budgetRatio: number;
  accounts: Array<{
    id: string;
    name: string;
    type: "bank" | "wallet" | "cash" | "savings" | "transfer";
    balance: number;
    spendable: boolean;
  }>;
  liabilities: Array<{
    id: string;
    name: string;
    type: "credit_card" | "loan" | "other";
    dueAmount: number;
    statementDate?: string;
    dueDate?: string;
    creditLimit?: number;
  }>;
  actionItems: Array<{
    id: string;
    label: string;
    dueDate: string;
    status: "upcoming" | "due_soon" | "scheduled";
    amount?: number;
    suggestedAccount?: string;
  }>;
  incomeSources: Array<{
    id: string;
    name: string;
    amount: number;
    targetAccount: string;
    ratio: number;
  }>;
  paymentChannels: Array<{
    id: string;
    name: string;
    amount: number;
    ratio: number;
  }>;
  investments: {
    total: number;
    pnl: number;
    holdings: Array<{
      id: string;
      name: string;
      type: string;
      amount: number;
      pnl: number;
    }>;
  };
  cashFlowPoints: Array<{
    date: string;
    income: number;
    expense: number;
    balance: number;
  }>;
  netAssetSnapshots: Array<{
    period: string;
    netAssets: number;
    delta?: number;
  }>;
  categories: Array<{ name: string; amount: number; ratio: number }>;
  recentTransactions: Array<{
    id: string;
    date: string;
    label: string;
    category: string;
    channel?: string;
    sourceAccount?: string;
    targetAccount?: string;
    amount: number;
    direction: "income" | "expense" | "transfer";
  }>;
};
```

## Styling Checklist

The first implementation must enforce:

- white canvas
- black primary text
- low contrast dividers
- mono numerals
- large whitespace
- no saturated color except alert state

## Responsive Checklist

### Desktop

- `max-width: 1024px`
- header and input full width
- body split into 8/4 layout

### Mobile

- single column
- metric hero first
- fixed bottom command input
- cash-flow trend before detailed ranked lists
- transactions at the end of the page

## Interaction Checklist

### Capture Composer

Phase 1:

- structured quick-entry mode
- type selector
- transfer selector
- category selector
- channel or receiving-account selector
- conditional transfer source and target selectors
- custom channel or account creation
- amount validation
- success message
- error message
- natural-language assist mode that prefills, not auto-commits

Phase 2:

- parser chips
- recent tags
- smart transfer suggestions
- agent affordances

### Dashboard Charts

Phase 1:

- one primary `cash-flow trend` chart
- income shown as positive bars
- expense shown as negative bars
- balance shown as a thin line
- transfer entries excluded from chart totals
- one compact `net-asset snapshot` block for monthly direction

Phase 2:

- richer drill-down by period
- toggle between daily and monthly cash-flow grouping
- net-asset comparison vs previous month or quarter

## State Checklist

Every block should support:

- default
- loading
- empty
- alert where relevant

## Recommended Build Order

1. page layout shell
2. tokens and typography
3. financial overview block
4. accounts block
5. budget block
6. liability block
7. action queue
8. income block
9. cash-flow chart
10. net-asset snapshot
11. investment block
12. category and channel lists
13. recent transaction list
14. capture composer states
15. responsive polish

## What Not To Overbuild Yet

- no autonomous parser that writes directly without confirmation
- no live agent integration
- no complex animation system
- no dense filter UI
- no multi-theme system
- no brokerage-grade analytics
- no payroll-grade accounting rules
- no attempt to merge net-asset trend into the same chart as cash flow

## Definition Of Done

The first dashboard pass is done when:

- it matches The Editor tone on desktop and mobile
- all approved modules are visible
- spacing and typography are consistent
- loading and empty states exist
- the capture composer visually behaves as specified
- accounts, liabilities, channels, and investment summaries are visible
- income recording and income source visibility are both clear
- transfer recording does not get mixed into income or expense
- the primary trend chart clearly shows income, expense, and balance together
- net-asset direction is visible without opening a second page
- the page shows upcoming finance actions, not just historical records
- the page is ready to connect to real finance data
