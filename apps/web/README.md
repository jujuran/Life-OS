# Life OS Web

当前主要产品界面，使用 Next.js App Router。

## 路由

- `/`：Life OS 首页
- `/finance`：财务看板
- `/content`：内容工作台
- `/ai`：AI 工作台
- `/tools`：工具台
- `/health`、`/growth`：规划中的模块入口

## 本地运行

从仓库根目录执行：

```bash
pnpm install --frozen-lockfile
pnpm dev:web
```

生产构建：

```bash
pnpm build:web
```

## 数据

运行数据不属于源码。新安装默认使用操作系统的当前用户数据目录；已有 `apps/web/data` 的安装会继续沿用旧目录。真实 API Key、账单、SOP、产品资料和历史内容均应保留在本地，并由 `.gitignore` 排除。

公开 Demo 位于：

- `lib/finance-dashboard-seed.public.ts`
- `lib/content-studio-seed.public.ts`

不要在 Demo 中加入真实个人信息。
