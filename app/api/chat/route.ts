import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

// 重要：Anthropic SDK 依赖 node:*，必须用 Node.js 运行时，不能用 Edge
export const runtime = "nodejs";

// 流式响应不能被缓存
export const dynamic = "force-dynamic";

// 请求体类型
interface ChatRequestBody {
  messages: { role: "user" | "assistant"; content: string }[];
  system?: string;
}

export async function POST(req: NextRequest) {
  // 1. 解析请求体
  const body = (await req.json()) as ChatRequestBody;
  const { messages, system } = body;

  // 2. 校验参数
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "messages 必须是非空数组" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // 3. 检查 API Key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "未配置 ANTHROPIC_API_KEY。请在 .env.local 中设置，或在部署平台配置环境变量。",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // 4. 创建 Anthropic 客户端
  const client = new Anthropic({ apiKey });

  // 5. 创建流式响应
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system:
            system ??
            "你是一个友好、专业的 AI 助手。请用简洁清晰的中文回答问题。",
          messages,
        });

        // 监听流式事件，提取文本增量
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        // 客户端断开连接时会触发这里
        console.error("[chat] 流式响应出错:", err);
        try {
          controller.error(err);
        } catch {
          // controller 已经关闭，忽略
        }
      }
    },
  });

  // 6. 返回 SSE 响应
  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
