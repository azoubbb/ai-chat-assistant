"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

// ============ 类型定义 ============
type Role = "user" | "assistant";
interface Message {
  id: string;
  role: Role;
  content: string;
}
interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

// 生成简短随机 id
const genId = () => Math.random().toString(36).slice(2, 10);

// 用消息内容生成对话标题（取前 20 字）
const makeTitle = (text: string) =>
  text.trim().slice(0, 20) + (text.length > 20 ? "..." : "");

// 给后端的消息体（只发 role + content）
interface ApiMessage {
  role: Role;
  content: string;
}

// localStorage 键名
const STORAGE_KEY = "ai-chat-assistant:v1";

export default function ChatPage() {
  // ============ 状态 ============
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 标记 AI 正在生成回复的消息 id（用于显示光标）
  const [streamingId, setStreamingId] = useState<string | null>(null);
  // 标记是否已经从 localStorage 加载完（用于避免首次空数据覆盖）
  const [isLoaded, setIsLoaded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 当前激活的对话
  const active = conversations.find((c) => c.id === activeId) ?? null;

  // 消息变化时自动滚到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length, active?.messages[active.messages.length - 1]?.content]);

  // 首次加载：从 localStorage 恢复；没有则创建默认对话
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConversations(parsed);
          setActiveId(parsed[0].id);
          setIsLoaded(true);
          return;
        }
      }
    } catch (e) {
      console.error("[storage] 读取失败:", e);
    }
    // 无数据 / 解析失败：创建默认对话
    const first: Conversation = {
      id: genId(),
      title: "新对话",
      messages: [],
      createdAt: Date.now(),
    };
    setConversations([first]);
    setActiveId(first.id);
    setIsLoaded(true);
  }, []);

  // 自动保存：conversations 变化时写回 localStorage
  useEffect(() => {
    if (!isLoaded) return; // 首次加载未完成前不写回，避免空数据覆盖
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (e) {
      console.error("[storage] 保存失败:", e);
    }
  }, [conversations, isLoaded]);

  // ============ 操作函数 ============

  // 新建对话
  const handleNew = () => {
    const conv: Conversation = {
      id: genId(),
      title: "新对话",
      messages: [],
      createdAt: Date.now(),
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setSidebarOpen(false);
  };

  // 删除对话
  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  // 切换对话
  const handleSelect = (id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
  };

  // 工具：用 id 找到某个对话中指定消息的 index（用于函数式更新里安全定位）
  const appendToMessage = (
    convs: Conversation[],
    convId: string,
    msgId: string,
    chunk: string,
  ): Conversation[] =>
    convs.map((c) => {
      if (c.id !== convId) return c;
      return {
        ...c,
        messages: c.messages.map((m) =>
          m.id === msgId ? { ...m, content: m.content + chunk } : m,
        ),
      };
    });

  // 发送消息（核心：调用 API + 流式接收）
  const handleSend = async () => {
    const text = input.trim();
    if (!text || !activeId || streamingId) return;

    // 1. 准备消息：用户消息 + 占位的 AI 消息
    const userMsg: Message = { id: genId(), role: "user", content: text };
    const aiMsg: Message = { id: genId(), role: "assistant", content: "" };

    // 2. 取出当前对话历史（用于构建发给后端的消息数组）
    const current = conversations.find((c) => c.id === activeId);
    const historyForApi: ApiMessage[] = [
      ...(current?.messages ?? []).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user" as const, content: text },
    ];

    // 3. 更新 UI：把两条消息加进去，第一条用户消息自动设为标题
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeId) return c;
        return {
          ...c,
          title: c.messages.length === 0 ? makeTitle(text) : c.title,
          messages: [...c.messages, userMsg, aiMsg],
        };
      }),
    );
    setInput("");
    setStreamingId(aiMsg.id);

    // 4. 发起请求并流式接收
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyForApi }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }
      if (!res.body) {
        throw new Error("响应没有 body");
      }

      // 5. 读取 SSE 流
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        setConversations((prev) =>
          appendToMessage(prev, activeId, aiMsg.id, chunk),
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[chat] 出错:", msg);
      setConversations((prev) =>
        appendToMessage(
          prev,
          activeId,
          aiMsg.id,
          `\n\n[出错] ${msg}`,
        ),
      );
    } finally {
      setStreamingId(null);
    }
  };

  // 停止生成（简化：暂不实现 AbortController，UI 上隐藏按钮）
  // TODO 步骤 8 完善：接入 AbortController

  // 回车发送（Shift+Enter 换行）
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isStreaming = streamingId !== null;

  // ============ 渲染 ============
  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* ===== 侧边栏 ===== */}
      <aside
        className={`
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
          fixed md:static inset-y-0 left-0 z-30
          w-64 bg-[#171717] flex flex-col
          transition-transform duration-200
        `}
      >
        {/* 新建对话按钮 */}
        <div className="p-3">
          <button
            onClick={handleNew}
            className="w-full flex items-center gap-2 px-3 py-3 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            新建对话
          </button>
        </div>

        {/* 对话列表 */}
        <nav className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => handleSelect(conv.id)}
              className={`
                group flex items-center justify-between
                px-3 py-3 rounded-lg cursor-pointer text-sm
                ${conv.id === activeId ? "bg-white/10" : "hover:bg-white/5"}
                transition-colors
              `}
            >
              <span className="truncate flex-1">{conv.title}</span>
              <button
                onClick={(e) => handleDelete(conv.id, e)}
                className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-white/80 p-1"
                aria-label="删除对话"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                </svg>
              </button>
            </div>
          ))}
        </nav>

        {/* 底部信息 */}
        <div className="p-3 text-xs text-white/40 border-t border-white/10">
          AI Chat Assistant · v0.1
        </div>
      </aside>

      {/* 移动端遮罩 */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="md:hidden fixed inset-0 z-20 bg-black/50"
        />
      )}

      {/* ===== 主对话区 ===== */}
      <main className="flex-1 flex flex-col bg-[#212121] min-w-0">
        {/* 顶栏（移动端显示菜单按钮） */}
        <header className="md:hidden flex items-center p-3 border-b border-white/10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-white/10 rounded"
            aria-label="打开菜单"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <span className="ml-3 font-medium truncate">{active?.title}</span>
        </header>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto">
          {active?.messages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
              {active?.messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={msg.id === streamingId}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 输入框 */}
        <div className="border-t border-white/10 bg-[#212121]">
          <div className="max-w-3xl mx-auto p-4">
            <div className="relative flex items-end gap-2 bg-[#2f2f2f] rounded-2xl border border-white/10 focus-within:border-white/30 transition-colors">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isStreaming ? "AI 正在回复..." : "给 AI 发送消息... (Enter 发送, Shift+Enter 换行)"
                }
                rows={1}
                disabled={isStreaming}
                className="flex-1 bg-transparent resize-none outline-none px-4 py-3 max-h-40 text-sm placeholder:text-white/40 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className="m-2 p-2 rounded-lg bg-[#10a37f] hover:bg-[#0e8f6f] disabled:bg-white/10 disabled:cursor-not-allowed transition-colors"
                aria-label="发送"
              >
                {isStreaming ? (
                  <svg
                    className="animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-white/40 text-center mt-2">
              AI 可能会产生错误，请核实重要信息
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

// ============ 子组件 ============

// 空状态（没有消息时显示）
function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-full bg-[#10a37f]/10 flex items-center justify-center mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#10a37f"
          strokeWidth="2"
        >
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold mb-2">开始一段对话</h2>
      <p className="text-sm text-white/50 max-w-sm">
        在下方输入框提问、写作、翻译、编程…任何 AI 能帮上忙的事
      </p>
    </div>
  );
}

// 单条消息气泡
function MessageBubble({
  message,
  isStreaming,
}: {
  message: Message;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";
  const showCursor = isStreaming && !isUser;
  return (
    <div
      className={`
        flex gap-4 px-4 py-5 rounded-lg
        ${isUser ? "bg-[#2f2f2f]" : "bg-transparent"}
      `}
    >
      {/* 头像 */}
      <div
        className={`
          w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold
          ${isUser ? "bg-blue-600" : "bg-[#10a37f]"}
        `}
      >
        {isUser ? "U" : "AI"}
      </div>
      {/* 内容 */}
      <div className="flex-1 min-w-0 text-[15px]">
        {isUser ? (
          // 用户消息：原样显示，不渲染 Markdown
          <div className="whitespace-pre-wrap break-words leading-7">
            {message.content}
          </div>
        ) : (
          // AI 消息：用 react-markdown 渲染
          <div className="markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {message.content}
            </ReactMarkdown>
            {showCursor && (
              <span className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-white/70 animate-pulse" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
