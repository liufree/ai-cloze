import { chat } from "./ai";
import type { ClozeTerm, ProviderSettings } from "./types";
import { t } from "./i18n";

/** AI cloze prompt: requires JSON output of candidate cloze terms (source snippets + importance) */
export function clozeSystemPrompt(): string {
  return t("prompt.system");
}

/** Best-effort extraction of JSON from AI-returned text (tolerates code fences and surrounding noise) */
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

/** Validate and normalize the terms list returned by the AI */
export function normalizeTerms(raw: unknown): ClozeTerm[] {
  if (!raw || typeof raw !== "object" || !("terms" in raw)) return [];
  const arr: unknown[] = Array.isArray(raw.terms) ? raw.terms : [];
  const seen = new Set<string>();
  const out: ClozeTerm[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object" || !("text" in item)) continue;
    const text = item.text;
    if (typeof text !== "string") continue;
    const t = text.trim();
    if (!t || t.length > 60) continue;
    if (/[#*[\]|`]/.test(t)) continue; // exclude markdown symbols
    if (seen.has(t)) continue;
    seen.add(t);
    const importance =
      "importance" in item && typeof item.importance === "number" && Number.isFinite(item.importance)
        ? Math.max(1, Math.min(10, Math.round(item.importance)))
        : 5;
    out.push({ text: t, importance });
  }
  // sort by importance descending, as the order in which terms are masked by density
  out.sort((a, b) => b.importance - a.importance);
  return out;
}

/** Pick the terms to mask based on density (0-100) — take the top n% by importance */
export function pickMasked(terms: ClozeTerm[], density: number): Set<string> {
  const n = Math.max(0, Math.min(100, density));
  if (terms.length === 0) return new Set();
  const count = Math.max(1, Math.round((terms.length * n) / 100));
  const masked = new Set(terms.slice(0, count).map((t) => t.text));
  return masked;
}

/** Simple content hash used to detect whether a note has changed */
export function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/** Build the note body for the prompt (strip frontmatter, truncate very long bodies) */
export function prepareNoteText(raw: string, maxLen = 12000): string {
  let text = raw;
  if (text.startsWith("---")) {
    const end = text.indexOf("\n---", 3);
    if (end !== -1) text = text.slice(end + 4);
  }
  text = text.replace(/\r\n/g, "\n").trim();
  return text.length > maxLen ? text.slice(0, maxLen) + t("prompt.truncated") : text;
}

/** Call the AI to generate a list of candidate cloze terms */
export async function generateClozeTerms(
  provider: ProviderSettings,
  raw: string
): Promise<ClozeTerm[]> {
  const noteText = prepareNoteText(raw);
  const content = await chat(
    provider,
    [
      { role: "system", content: clozeSystemPrompt() },
      { role: "user", content: t("prompt.user", { text: noteText }) },
    ],
    true
  );
  return normalizeTerms(extractJson(content));
}
