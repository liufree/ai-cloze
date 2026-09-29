import { requestUrl } from "obsidian";
import type { ProviderSettings, ProviderKind } from "./types";
import { t } from "./i18n";

export const PROVIDER_PRESETS: Record<
  ProviderKind,
  { baseUrl: string; defaultModel: string }
> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-haiku-latest",
  },
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "qwen2.5:7b",
  },
};

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Calls any OpenAI-compatible endpoint (OpenAI / Ollama / DeepSeek, etc.).
 * OpenAI-compatible APIs share a unified semantics, and Ollama also implements /v1/chat/completions.
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
    throw new Error(t("err.requestFailed", { status: res.status, err: trimErr(res.text) }));
  }
  const json = res.json as
    | { choices?: Array<{ message?: { content?: unknown } }> }
    | null
    | undefined;
  const content: unknown = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error(t("err.noContent"));
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
    throw new Error(t("err.requestFailed", { status: res.status, err: trimErr(res.text) }));
  }
  const parts: Array<{ type?: string; text?: string }> =
    (res.json as { content?: Array<{ type?: string; text?: string }> } | null)?.content ?? [];
  const text = parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("");
  if (!text) throw new Error(t("err.noText"));
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
      throw new Error(t("err.unknownProvider", { name: s.provider }));
  }
}

function trimErr(t: string | undefined): string {
  const s = (t || "").trim();
  return s.length > 300 ? s.slice(0, 300) + "…" : s;
}

/**
 * Connectivity test: sends a minimal request to verify that the Base URL / Key / model are usable.
 * Covers three providers — OpenAI-compatible / Anthropic / Ollama — and consumes almost no tokens.
 */
export async function testConnection(s: ProviderSettings): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "user", content: "Reply with exactly: OK" },
  ];
  return chat({ ...s, temperature: 0, maxTokens: 16 }, messages, false);
}
