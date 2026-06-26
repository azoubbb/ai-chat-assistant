# 部署指南：从本地到线上

本指南把项目从你电脑部署到公网，让任何人都能通过 URL 访问。

整体流程：申请 API Key → 推送 GitHub → Vercel 部署 → 配置环境变量。

---

## 步骤 1：申请 Anthropic API Key

1. 打开 https://console.anthropic.com 注册账号
2. 完成邮箱验证 + 手机号绑定
3. 进入 Settings → API Keys：https://console.anthropic.com/settings/keys
4. 点击 "Create Key"，起个名字（比如 `chat-assistant`）
5. **复制 Key 并妥善保存**（格式：`sk-ant-api03-...`，只显示一次！）
6. 新账号通常会送 $5 额度，足够测试和日常使用

---

## 步骤 2：创建 GitHub 仓库并推送代码

### 2.1 在 GitHub 创建空仓库

1. 登录 GitHub
2. 点击右上角 `+` → `New repository`
3. 填写：
   - Repository name: `ai-chat-assistant`（或你喜欢的名字）
   - Description: `基于 Claude 的 AI 智能聊天助手`
   - **Public**（公开，让招聘方能直接看源码）
   - **不要**勾选 "Initialize with README"（本地已有）
4. 点击 "Create repository"

### 2.2 本地推送代码

打开 Git Bash，执行（替换 `你的用户名` 为你的 GitHub 用户名）：

```bash
cd "/c/Claude_code_program/第二个项目选题/ai-chat-assistant"

# 初始化本地仓库
git init
git add .
git commit -m "feat: AI 聊天助手 - 流式对话 + Markdown + 持久化"

# 添加远程仓库
git remote add origin https://github.com/你的用户名/ai-chat-assistant.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

**如果推送时弹出登录窗口**，正常输入 GitHub 用户名和 Personal Access Token（不是密码）。
没有 Token 的话去 https://github.com/settings/tokens 生成一个（需要 `repo` 权限）。

---

## 步骤 3：在 Vercel 部署

1. 打开 https://vercel.com 用 GitHub 账号登录
2. 点击 "Add New..." → "Project"
3. 在 "Import Git Repository" 中找到 `ai-chat-assistant`，点击 "Import"
4. 进入配置页：
   - **Framework Preset**: Next.js（自动识别，不用改）
   - **Root Directory**: `./`（默认）
   - **Build Command**: `next build`（默认）
   - **Output Directory**: 默认
5. **重要：先不要点 Deploy！** 先展开 "Environment Variables"，添加：
   - **Name**: `ANTHROPIC_API_KEY`
   - **Value**: 粘贴步骤 1 申请的 Key
   - Environment: 全部勾选（Production / Preview / Development）
6. 点击 "Deploy"

部署过程约 1-3 分钟。完成后会显示一个类似 `https://ai-chat-assistant-xxx.vercel.app` 的链接。

---

## 步骤 4：验证线上功能

1. 打开 Vercel 给的链接
2. 应该看到和本地一样的聊天界面
3. 输入消息测试：
   - 比如："用 Python 写一个快速排序"
   - 应该看到打字机效果，代码块带高亮
4. 刷新页面，历史对话应该还在（localStorage 持久化）
5. 用手机访问同一个链接，测试移动端样式

---

## 步骤 5：常见问题

### Q: 部署后显示 "Failed to fetch" 或 API 报错？
A: 大概率是 `ANTHROPIC_API_KEY` 没配对。回到 Vercel 项目 → Settings → Environment Variables 确认。

### Q: API 调用失败显示 401 / 403？
A: Key 无效或被吊销。重新申请一个，在 Vercel 更新环境变量后需要重新部署（Deployments → 找到最新 → Redeploy）。

### Q: 想绑定自定义域名？
A: Vercel 项目 → Settings → Domains → 添加你的域名。需要在域名注册商把 DNS 改成 Vercel 提供的。

### Q: 部署后样式不对？
A: 检查 build 日志（Vercel 项目 → Deployments → 点开 → 查看日志）。

---

## 步骤 6：简历上怎么写

部署完成后，简历项目经历可以这样写：

```
AI 智能聊天助手 | Next.js 16 + TypeScript + Anthropic Claude API
- 基于 Next.js App Router 全栈开发，支持 SSE 流式响应（打字机效果）
- 实现多轮对话上下文管理与 localStorage 历史持久化
- 集成 react-markdown + highlight.js，支持 Markdown 与代码高亮
- 通过 Vercel Serverless Function 代理 API 调用，避免 Key 泄露
- 在线预览：https://ai-chat-assistant-xxx.vercel.app
- 源码：https://github.com/你的用户名/ai-chat-assistant
```

---

## 完成 ✓

部署上线后，告诉 Claude Code "已部署"，可以接着做下一个项目（AI 文档问答 / RAG）。
