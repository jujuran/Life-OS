# Life OS

Life OS 是一个本地优先、面向长期个人使用的人生系统。它把财务、内容创作、AI 对话和常用工具放进同一套克制、可扩展的界面中，同时将程序代码与个人数据严格分开。

> 当前状态：Alpha。核心 Web 端可以本地运行，数据格式和模块边界仍可能调整。请先备份再升级。

## 当前能力

- 财务系统：收支与转账、账户余额、负债、预算、现金流、流水、备份与恢复
- 内容系统：多项目、项目资料、Markdown 写作 SOP、模型生成、审稿动作与历史
- AI Core：多 API Key、多模型配置、本地会话和文件上下文入口
- 工具台：番茄钟、切图、二维码、图片处理、文本与时间类工具
- 本地数据：默认写入当前用户的数据目录，不随 Git 仓库提交
- Demo 数据：新安装可以直接浏览通用示例，不包含维护者的个人资料

健康等模块仍在规划或占位阶段。

## 隐私边界

以下内容不属于公开仓库，也不应提交到 Git：

- 账单、账户名称、余额、负债和备份
- API Key 与本地模型配置
- 私人产品资料、写作 SOP、历史笔记和 AI 会话
- 任何包含真实身份、联系方式或个人习惯的数据

默认数据目录：

- Windows：`%LOCALAPPDATA%\Life OS`
- macOS：`~/Library/Application Support/Life OS`
- Linux：`$XDG_DATA_HOME/life-os` 或 `~/.local/share/life-os`

已有 `apps/web/data` 的旧安装会继续使用该目录，避免升级后丢失数据。也可用 `LIFE_OS_DATA_DIR` 指定私人数据目录。详见 [隐私与数据说明](docs/privacy-and-data.md)。

## 快速开始

要求：

- Node.js 22 LTS（最低 20.9）
- pnpm 10.33.0

```bash
git clone https://github.com/jujuran/Life-OS.git
cd Life-OS
corepack enable
pnpm install --frozen-lockfile
pnpm dev:web
```

浏览器打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)。

如需使用 AI，在 `apps/web/.env.local.example` 的基础上创建 `apps/web/.env.local`，或在系统的 AI 配置界面中保存本地设置。不要把真实 Key 写入示例文件。

Windows 用户完成依赖安装后，也可以运行：

```powershell
.\Start-LifeOS.ps1
```

更多步骤见 [安装指南](docs/installation.md)。

## 常用命令

```bash
pnpm dev:web
pnpm lint
pnpm build
pnpm test
```

## 仓库结构

- `apps/web`：当前主要产品，Next.js App Router
- `packages/domain`：领域模型与通用规则
- `packages/db`：数据仓储接口
- `packages/agents`：未来 Agent 能力和安全边界
- `packages/ui`：共享 UI 边界
- `docs`：架构、安装、隐私和实现文档

`apps/api`、`apps/desktop`、`apps/mobile` 目前主要是未来扩展边界，不代表已经完成。

## 设计原则

1. 个人长期使用优先，但不把个人数据写死进产品核心。
2. 本地优先，云同步和远程 Agent 作为可替换能力。
3. Agent 通过受控用例操作数据，不直接修改存储文件。
4. 高风险动作必须可预览、可确认、可审计。
5. Demo 数据与私人数据使用相同结构，但永不混用。

## 参与贡献

提交代码前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请按 [SECURITY.md](SECURITY.md) 私下报告，不要在公开 Issue 中粘贴密钥或个人数据。

## License

Apache License 2.0，见 [LICENSE](LICENSE)。
