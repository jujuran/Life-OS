# 安装指南

## 环境要求

- Node.js 22 LTS，最低 20.9
- pnpm 10.33.0
- Git

确认版本：

```bash
node --version
pnpm --version
git --version
```

如果本机没有 pnpm，可通过 Node 自带的 Corepack 启用：

```bash
corepack enable
corepack prepare pnpm@10.33.0 --activate
```

## 获取与启动

```bash
git clone https://github.com/jujuran/Life-OS.git
cd Life-OS
pnpm install --frozen-lockfile
pnpm dev:web
```

访问 `http://127.0.0.1:3000`。首次运行没有私人数据时会展示通用 Demo。

## AI 配置

复制示例文件：

Windows PowerShell：

```powershell
Copy-Item apps/web/.env.local.example apps/web/.env.local
```

macOS / Linux：

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

填写自己的服务地址、Key 和模型，或在 AI 模块的配置弹窗中保存。真实值只应存在本地。

## Windows 启动脚本

完成依赖安装后，可在仓库根目录运行：

```powershell
.\Start-LifeOS.ps1
```

常用参数：

```powershell
.\Start-LifeOS.ps1 -Page finance
.\Start-LifeOS.ps1 -NoBrowser
.\Stop-LifeOS.ps1
```

仓库同时提供中文批处理和静默 VBS 入口。启动脚本只服务本机，不负责公网部署。

## 生产构建

```bash
pnpm build
pnpm --filter @life-os/web start
```

公开网络部署尚不是默认支持模式。若自行部署，必须先增加身份认证、TLS、访问控制和独立的秘密管理。
