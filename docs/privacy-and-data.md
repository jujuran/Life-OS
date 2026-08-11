# 隐私与数据说明

Life OS 将通用程序与私人运行数据分离。Git 仓库可以更新代码，但不应成为个人数据备份。

## 数据目录选择

系统按以下顺序确定数据目录：

1. `LIFE_OS_DATA_DIR` 指定的目录
2. 已存在的旧目录 `apps/web/data`
3. 操作系统当前用户的数据目录

平台默认位置：

- Windows：`%LOCALAPPDATA%\Life OS`
- macOS：`~/Library/Application Support/Life OS`
- Linux：`$XDG_DATA_HOME/life-os` 或 `~/.local/share/life-os`

旧目录优先只用于兼容已有安装。新用户不会在源码目录中自动创建私人数据。

## 本地文件

当前可能包含：

- `finance-ledger.json`：流水、账户调整、待处理事项与财务配置
- `content-studio.json`：项目、产品资料、SOP、输出和历史
- `ai-settings.json`：模型服务与 API Key 配置
- `ai-conversations.json`：AI 会话
- `backups/`：财务备份

这些文件均被 Git 排除。不要为了“方便同步”取消忽略规则。

## Demo 与私人数据

公开 Demo 文件只使用虚构项目、通用账户和示例金额。安装后写入的真实内容保存在私人数据目录，不会回写到 Demo Seed。

## AI 数据流

启用 AI 时，任务目标、选题、参考文字、产品资料、SOP 或会话附件可能被发送给所选服务商。Life OS 无法替代服务商的隐私政策。建议：

- 只发送完成任务所需的最小上下文
- 不把账单、健康数据或身份信息发送给不可信中转服务
- 为不同用途使用独立 Key
- 定期轮换并删除停用 Key

## 备份

财务模块可以在私人数据目录的 `backups` 子目录生成备份。完整备份时应同时保存整个私人数据目录，并使用加密磁盘或加密归档。

GitHub 不是私人数据备份方案。代码版本和私人数据备份应保持两条独立链路。
