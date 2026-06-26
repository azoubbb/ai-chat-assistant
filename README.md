# AI Chat Assistant

基于 Next.js 16 + Anthropic Claude 的 AI 智能聊天助手，支持流式对话、Markdown 渲染、历史持久化。

🔗 **在线演示**：https://ai-chat-assistant-five-gules.vercel.app

## ✨ 功能特性

- 💬 **流式对话** — SSE 流式响应，打字机效果逐字输出
- 🧠 **多轮上下文** — 完整对话历史传给 LLM，AI 能记住前面对话
- 💾 **本地持久化** — 对话历史保存在 localStorage，刷新不丢失
- 📝 **Markdown 渲染** — 集成 react-markdown，支持 GFM（表格、删除线、任务列表）
- 🎨 **代码高亮** — highlight.js 自动识别 190+ 语言
- 🌗 **深色主题** — ChatGPT 风格深色配色
- 📱 **移动端适配** — 侧边栏可折叠，触摸友好

## 🛠 技术栈

| 类别 | 选型 |
|---|---|
| 框架 | Next.js 16 (App Router + Turbopack) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS 4 |
| LLM | Anthropic Claude API (SSE 流式) |
| Markdown | react-markdown + remark-gfm |
| 代码高亮 | rehype-highlight + highlight.js |
| 部署 | Vercel Serverless |

## 🚀 本地开发

### 1. 克隆并安装

```bash
git clone https://github.com/azoubbb/ai-chat-assistant.git
cd ai-chat-assistant
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`，填入你的 API Key：

```bash
# 方式 A：Anthropic 官方（需要海外网络）
ANTHROPIC_API_KEY=sk-ant-api03-你的Key

# 方式 B：第三方代理平台（兼容 Anthropic 协议）
ANTHROPIC_API_KEY=你的Key
ANTHROPIC_BASE_URL=https://代理地址/anthropic
ANTHROPIC_MODEL=平台支持的模型名
```

### 3. 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000

## 📦 部署

详细部署指南见 [DEPLOY.md](./DEPLOY.md)。

简述：推送 GitHub → Vercel 导入 → 配置环境变量 → Deploy。

## 📁 项目结构

```
ai-chat-assistant/
├── app/
│   ├── api/chat/route.ts     # API 路由：代理 Claude 调用 + SSE 流式
│   ├── page.tsx              # 主页面：所有聊天 UI 和状态管理
│   ├── layout.tsx            # 根布局 + metadata
│   └── globals.css           # 全局样式 + Markdown 排版
├── .env.example              # 环境变量模板
├── .env.local                # 本地真实配置（gitignore）
├── DEPLOY.md                 # Vercel 部署详细指南
└── package.json
```

## 🔐 安全说明

- API Key 仅存在于服务端（`app/api/chat/route.ts` 通过 `process.env.ANTHROPIC_API_KEY` 读取）
- 前端通过 `/api/chat` 路由调用，**前端 bundle 不包含任何 Key**
- `.env.local` 已被 `.gitignore` 排除，不会被提交

## 📜 License

MIT
