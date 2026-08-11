# Contributing to Life OS

感谢你愿意帮助改进 Life OS。项目目前仍处于 Alpha，维护重点是本地优先、隐私边界和可验证的小步迭代。

## 开始之前

1. 先搜索已有 Issue，确认问题尚未被记录。
2. 对结构性改动先开 Issue，说明使用场景、数据影响和迁移方式。
3. Fork 仓库并从最新 `main` 创建分支。
4. 不要在 Issue、提交、测试夹具或截图中包含真实个人数据。

## 本地校验

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm build
pnpm test
```

Pull Request 应说明：

- 用户可见的变化
- 数据格式或迁移影响
- 隐私与安全影响
- 已执行的测试
- 必要时提供使用 Demo 数据生成的截图

## 数据与示例

允许提交：

- 通用程序逻辑
- 匿名、虚构的 Demo 数据
- 不含真实密钥的 `.env.example`
- 可复现的测试夹具

禁止提交：

- `.env.local` 或 API Key
- `apps/web/data` 及其备份
- 真实账单、账户、负债和健康数据
- 私人 SOP、产品资料、AI 对话和内容历史
- 能识别个人身份的日志与截图

如果误提交敏感信息，请立即停止推送并按照 [SECURITY.md](SECURITY.md) 联系维护者。仅删除最新文件并不能清除 Git 历史。

## 代码风格

- TypeScript 优先使用明确类型和小型纯函数。
- 数据写入必须经过仓储或受控用例，不直接散落在组件中。
- UI 延续 Life OS 的黑白灰、排版驱动和低干扰风格。
- 新模块应提供空状态、错误状态和最小 Demo。
- 不为未来功能提前引入大体积依赖。
