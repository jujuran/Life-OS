import type { FinanceDashboardViewModel } from "@life-os/domain/finance-model";

export const financeDashboardSeed: FinanceDashboardViewModel = {
  periodLabel: "2026 / 04 月",
  capture: {
    directions: [
      { value: "expense", label: "支出" },
      { value: "income", label: "收入" },
      { value: "transfer", label: "转账" }
    ],
    categories: {
      expense: ["餐饮", "交通", "居住", "日用", "娱乐", "其他支出"],
      income: ["工资", "副业", "红包", "理财收益", "退款", "报销", "其他收入"],
      transfer: ["账户划转", "信用账户还款", "储蓄转理财", "提现", "退款回卡"]
    },
    registries: {
      expense: ["钱包 A", "钱包 B", "银行卡 A", "银行卡 B", "信用账户 A", "现金"],
      income: ["银行卡 A", "银行卡 B", "钱包 A", "钱包 B", "储蓄账户"],
      transfer: [
        "银行卡 A",
        "银行卡 B",
        "钱包 A",
        "钱包 B",
        "储蓄账户",
        "理财账户",
        "信用账户 A"
      ]
    },
    assistantExamples: [
      "打车 45 钱包 A",
      "工资 12000 银行卡 A",
      "提现 500 银行卡 A",
      "银行卡 A 转 信用账户 A 3280"
    ]
  },
  overview: [
    {
      id: "expense",
      label: "本月支出",
      value: "¥8,450.00",
      note: "示例支出",
      hero: true
    },
    {
      id: "income",
      label: "本月收入",
      value: "¥12,000.00",
      note: "示例收入"
    },
    {
      id: "balance",
      label: "本月结余",
      value: "¥3,550.00",
      note: "示例结余"
    },
    {
      id: "net-assets",
      label: "净资产",
      value: "¥174,120.00",
      note: "总资产 ¥186,420 · 总负债 ¥12,300"
    }
  ],
  fundAccounts: [
    {
      id: "bank-a",
      name: "银行卡 A",
      tag: "主账户",
      description: "示例资金账户",
      balance: "¥12,860.00",
      type: "bank"
    },
    {
      id: "wallet-a",
      name: "钱包 A",
      tag: "钱包账户",
      description: "示例日常消费账户",
      balance: "¥3,260.00",
      type: "wallet"
    },
    {
      id: "wallet-b",
      name: "钱包 B",
      tag: "钱包账户",
      description: "示例备用钱包",
      balance: "¥1,240.00",
      type: "wallet"
    },
    {
      id: "savings",
      name: "储蓄账户",
      tag: "储蓄账户",
      description: "示例备用金账户",
      balance: "¥28,000.00",
      type: "savings"
    }
  ],
  budget: {
    used: 8450,
    total: 12000,
    ratio: 0.7,
    label: "当前进度 70%"
  },
  liabilities: {
    total: "¥12,300.00",
    dueThisMonth: "¥5,860.00",
    items: [
      {
        id: "credit-a",
        name: "信用账户 A",
        tag: "04-24 还款",
        description: "示例信用账户，本期应还 ¥3,280",
        dueAmount: "¥3,280.00",
        type: "credit_card",
        alert: true
      },
      {
        id: "other-liability",
        name: "其他负债",
        tag: "待确认",
        description: "示例其他负债",
        dueAmount: "¥2,580.00",
        type: "other"
      }
    ]
  },
  actionItems: [
    {
      id: "repay-credit-a",
      label: "信用账户还款",
      tag: "2 天后",
      description: "示例待处理事项",
      dueDate: "04-24"
    },
    {
      id: "rent-check",
      label: "固定支出确认",
      tag: "本周",
      description: "核对示例固定支出",
      dueDate: "04-19"
    }
  ],
  incomeSources: [
    { id: "salary", name: "工资", amount: "¥9,500", ratio: 0.79 },
    { id: "side-hustle", name: "副业", amount: "¥1,800", ratio: 0.15 },
    { id: "investment-income", name: "理财收益", amount: "¥520", ratio: 0.04 }
  ],
  cashFlow: [
    { id: "w1", label: "04-03", income: 1800, expense: 920, balance: 880 },
    { id: "w2", label: "04-07", income: 2600, expense: 1480, balance: 1120 },
    { id: "w3", label: "04-10", income: 1200, expense: 560, balance: 640 },
    { id: "w4", label: "04-12", income: 3200, expense: 1880, balance: 1320 },
    { id: "w5", label: "04-14", income: 2100, expense: 760, balance: 1340 },
    { id: "w6", label: "04-17", income: 2900, expense: 1640, balance: 1260 },
    { id: "w7", label: "04-21", income: 1600, expense: 820, balance: 780 }
  ],
  netAssetSnapshots: [
    { id: "jan", label: "01 月", value: "¥161,800", delta: "+¥2,400" },
    { id: "feb", label: "02 月", value: "¥165,240", delta: "+¥3,440" },
    { id: "mar", label: "03 月", value: "¥170,860", delta: "+¥5,620" },
    { id: "apr", label: "04 月", value: "¥174,120", delta: "+¥3,260" }
  ],
  investments: {
    total: "¥141,060.00",
    pnl: "+¥2,486.00",
    items: [
      {
        id: "cash-management",
        name: "现金管理",
        tag: "低风险",
        description: "示例理财账户",
        amount: "¥18,200.00"
      },
      {
        id: "fund-portfolio",
        name: "基金组合",
        tag: "稳健",
        description: "示例长期账户",
        amount: "¥36,800.00"
      },
      {
        id: "equity-portfolio",
        name: "权益组合",
        tag: "长期",
        description: "示例风险资产",
        amount: "¥86,060.00"
      }
    ]
  },
  categories: [
    { id: "food", name: "餐饮", amount: "¥3,000", ratio: 0.52 },
    { id: "housing", name: "居住", amount: "¥2,500", ratio: 0.43 },
    { id: "transport", name: "交通", amount: "¥800", ratio: 0.16 }
  ],
  paymentChannels: [
    { id: "wallet-a", name: "钱包 A", amount: "¥3,980", ratio: 0.47 },
    { id: "bank-a", name: "银行卡 A", amount: "¥2,960", ratio: 0.35 },
    { id: "wallet-b", name: "钱包 B", amount: "¥1,120", ratio: 0.13 }
  ],
  recentFlows: [
    {
      id: "taxi",
      date: "04-16",
      label: "打车",
      description: "交通 · 钱包 A · 示例记录",
      amount: "-¥45.00",
      direction: "expense"
    },
    {
      id: "coffee",
      date: "04-15",
      label: "咖啡",
      description: "餐饮 · 钱包 B · 示例记录",
      amount: "-¥28.00",
      direction: "expense"
    },
    {
      id: "salary",
      date: "04-12",
      label: "工资",
      description: "工资 · 银行卡 A · 示例收入",
      amount: "+¥12,000.00",
      direction: "income"
    },
    {
      id: "withdraw-transfer",
      date: "04-12",
      label: "账户划转",
      description: "账户划转 · 钱包 A -> 银行卡 A · 示例转账",
      amount: "→¥500.00",
      direction: "transfer"
    }
  ]
};
