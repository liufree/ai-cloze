import { chat } from "./ai";
import type { ClozeTerm, ProviderSettings } from "./types";

/** AI 挖空提示词：要求返回 JSON，输出候选挖空词（原文片段 + 重要性） */
export const CLOZE_SYSTEM_PROMPT = `你是记忆助手。用户会给一篇笔记的原文，你的任务是找出值得记忆的"关键知识点/关键短语"，用于制作挖空(cloze)阅读。

要求：
1. 只输出一个 JSON 对象，不要任何其它文字、不要 markdown 代码块围栏。
2. JSON 格式：{"terms": [{"text": "关键短语", "importance": 8}, ...]}
3. text 必须是笔记原文中真实出现的连续片段，通常 2-12 个字符（英文 1-4 个词）。
4. importance 1-10 表示这个知识点的重要程度，越重要数字越大，用于控制挖空密度。
5. 选取 10-40 个有代表性的知识点，覆盖全文重点，避免重复和无意义词（如"的、是、在"）。
6. 不要包含 markdown 语法符号（如 #、*、[、]、|）。`;

/** 从 AI 返回文本中尽力提取 JSON（容忍代码块围栏、前后杂讯） */
export function extractJson(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end > start) {
    t = t.slice(start, end + 1);
  }
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/** 校验并归一化 AI 返回的 terms 列表 */
export function normalizeTerms(raw: unknown): ClozeTerm[] {
  if (!raw || typeof raw !== "object" || !("terms" in raw)) return [];
  const arr = raw.terms;
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: ClozeTerm[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object" || !("text" in item)) continue;
    const text = item.text;
    if (typeof text !== "string") continue;
    const t = text.trim();
    if (!t || t.length > 60) continue;
    if (/[#*[\]|`]/.test(t)) continue; // 排除 markdown 符号
    if (seen.has(t)) continue;
    seen.add(t);
    const importance =
      "importance" in item && typeof item.importance === "number" && Number.isFinite(item.importance)
        ? Math.max(1, Math.min(10, Math.round(item.importance)))
        : 5;
    out.push({ text: t, importance });
  }
  // 按重要性降序，作为密度控制的挖空顺序
  out.sort((a, b) => b.importance - a.importance);
  return out;
}

/** 根据密度(0-100)选出应被挖空的词（按重要性从高到低取前 n%） */
export function pickMasked(terms: ClozeTerm[], density: number): Set<string> {
  const n = Math.max(0, Math.min(100, density));
  if (terms.length === 0) return new Set();
  const count = Math.max(1, Math.round((terms.length * n) / 100));
  const masked = new Set(terms.slice(0, count).map((t) => t.text));
  return masked;
}

/** 简单内容哈希，用于检测笔记是否变化 */
export function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/** 构建提示用的笔记正文（去 frontmatter，截断超长正文） */
export function prepareNoteText(raw: string, maxLen = 12000): string {
  let t = raw;
  if (t.startsWith("---")) {
    const end = t.indexOf("\n---", 3);
    if (end !== -1) t = t.slice(end + 4);
  }
  t = t.replace(/\r\n/g, "\n").trim();
  return t.length > maxLen ? t.slice(0, maxLen) + "\n…（已截断）" : t;
}

/** 调用 AI 生成挖空候选词列表 */
export async function generateClozeTerms(
  provider: ProviderSettings,
  raw: string
): Promise<ClozeTerm[]> {
  const noteText = prepareNoteText(raw);
  const content = await chat(
    provider,
    [
      { role: "system", content: CLOZE_SYSTEM_PROMPT },
      { role: "user", content: `以下是笔记原文，请分析并输出挖空候选：\n\n${noteText}` },
    ],
    true
  );
  return normalizeTerms(extractJson(content));
}
