import { requestUrl, RequestUrlParam } from "obsidian";
import type { ProviderSettings, ProviderKind } from "./types";

export const PROVIDER_PRESETS: Record<
  ProviderKind,
  { label: string; baseUrl: string; defaultModel: string }
> = {
  openai: {
    label: "OpenAI 兼容",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  },
  anthropic: {
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-haiku-latest",
  },
  ollama: {
    label: "Ollama（本地）",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "qwen2.5:7b",
  },
};

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * 调用任意 OpenAI 兼容端点（OpenAI / Ollama / DeepSeek 等）。
 * OpenAI 兼容 API 语义统一，Ollama 也实现了 /v1/chat/completions。
 */
async function callOpenAICompatible(
  s: ProviderSettings,
  messages: ChatMessage[],
  jsonMode: boolean
): Promise<string> {
  const body: Record<string, unknown> = {
    model: s.model,
    messages,
    temperature: s.temperature,
    max_tokens: s.maxTokens,
  };
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (s.apiKey) headers["Authorization"] = `Bearer ${s.apiKey}`;

  const res = await requestUrl({
    url: `${s.baseUrl.replace(/\/$/, "")}/chat/completions`,
    method: "POST",
    headers,
    body: JSON.stringify(body),
    throw: false,
  });
  if (res.status !== 200) {
    throw new Error(`AI 请求失败（HTTP ${res.status}）：${trimErr(res.text)}`);
  }
  const json = res.json;
  const content: unknown = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("AI 返回内容缺失：choices[0].message.content 为空");
  }
  return content;
}

/** Anthropic Messages API */
async function callAnthropic(
  s: ProviderSettings,
  messages: ChatMessage[],
  _jsonMode: boolean
): Promise<string> {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const body = {
    model: s.model,
    max_tokens: s.maxTokens,
    temperature: s.temperature,
    system: system || undefined,
    messages: messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content })),
  };
  const res = await requestUrl({
    url: `${s.baseUrl.replace(/\/$/, "")}/messages`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": s.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    throw: false,
  });
  if (res.status !== 200) {
    throw new Error(`AI 请求失败（HTTP ${res.status}）：${trimErr(res.text)}`);
  }
  const parts: Array<{ type?: string; text?: string }> = res.json?.content ?? [];
  const text = parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("");
  if (!text) throw new Error("AI 返回内容缺失：content 无文本");
  return text;
}

export async function chat(
  s: ProviderSettings,
  messages: ChatMessage[],
  jsonMode = false
): Promise<string> {
  switch (s.provider) {
    case "anthropic":
      return callAnthropic(s, messages, jsonMode);
    case "openai":
    case "ollama":
      return callOpenAICompatible(s, messages, jsonMode);
    default:
      throw new Error(`未知 Provider：${s.provider}`);
  }
}

function trimErr(t: string | undefined): string {
  const s = (t || "").trim();
  return s.length > 300 ? s.slice(0, 300) + "…" : s;
}

/**
 * 连通性测试：发送极小请求，验证 Base URL / Key / 模型是否可用。
 * 覆盖 OpenAI 兼容 / Anthropic / Ollama 三种 Provider，几乎不消耗 token。
 */
export async function testConnection(s: ProviderSettings): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "user", content: "Reply with exactly: OK" },
  ];
  return chat({ ...s, temperature: 0, maxTokens: 16 }, messages, false);
}
