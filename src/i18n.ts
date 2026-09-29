/**
 * Lightweight i18n: zh/en dictionaries + language detection.
 * Language comes from Obsidian's getLanguage(); falls back to the system
 * language. Chinese (zh-Hans/zh-TW etc.) -> zh, everything else -> en.
 */
import { getLanguage } from "obsidian";

/** User-facing language preference stored in plugin settings. */
export type LanguageSetting = "system" | "zh" | "en";
/** Resolved locale actually in effect. */
export type Locale = "zh" | "en";

let locale: Locale = "en";

/** Detect the Obsidian UI language. */
export function detectLocale(): Locale {
  const lang = (getLanguage() || navigator.language || "en").toLowerCase();
  return lang.startsWith("zh") ? "zh" : "en";
}

/**
 * Apply the stored language preference. "system" follows the Obsidian UI
 * language; otherwise the explicit zh/en is forced.
 */
export function applyLanguage(lang: LanguageSetting): void {
  locale = lang === "system" ? detectLocale() : lang;
}

const zh: Record<string, string> = {
  // commands
  "cmd.openView": "打开当前笔记的 AI 挖空阅读视图",
  "cmd.openViewGenerate": "打开 AI 挖空阅读视图（重新 AI 挖空）",
  "action.openView": "打开 AI 挖空阅读视图",

  // view
  "view.display.withFile": "AI 挖空 · {name}",
  "view.display.empty": "AI 挖空阅读",

  // main
  "notice.backgroundDone": "已后台生成「{name}」挖空（{count} 个知识点）",
  "notice.backgroundFail": "后台挖空失败：{err}",

  // settings
  "settings.title": "ai-cloze · AI 挖空阅读",
  "settings.languageName": "界面语言",
  "settings.languageDesc": "界面语言。默认跟随 Obsidian 界面语言。",
  "settings.languageSystem": "跟随系统",
  "settings.providerName": "Provider",
  "settings.providerDesc":
    "选择 AI 服务商。OpenAI 兼容接口可用于 OpenAI / DeepSeek / Moonshot 等；Ollama 为本地模型。",
  "settings.baseUrlName": "API 地址（Base URL）",
  "settings.baseUrlDesc":
    "OpenAI 兼容端点，如 https://api.openai.com/v1 或 http://localhost:11434/v1（Ollama）",
  "settings.apiKeyName": "API Key",
  "settings.apiKeyDesc": "本地 Ollama 可留空。密钥仅保存在本机 data.json。",
  "settings.modelName": "模型（Model）",
  "settings.modelDesc": "例如 gpt-4o-mini / claude-3-5-haiku-latest / qwen2.5:7b",
  "settings.tempName": "温度（Temperature）",
  "settings.tempDesc": "越低越稳定。挖空推荐 0.1 - 0.5。",
  "settings.maxTokensName": "最大输出 Token",
  "settings.maxTokensDesc": "AI 返回挖空列表的最大 token 数。",
  "settings.testName": "测试 AI 连通性",
  "settings.testDesc": "发送一个极小请求，验证 API 地址、Key 与模型是否可用（几乎不消耗 token）。",
  "settings.testButton": "测试连通",
  "settings.testingButton": "测试中…",
  "settings.densityName": "默认挖空密度",
  "settings.densityDesc": "0-100，默认每次打开时挖空的比例。可在阅读视图中单独调整。",
  "settings.autoClozeName": "自动挖空（打开视图时）",
  "settings.autoClozeDesc":
    "开启后，打开挖空视图时若该笔记没有缓存，会自动调用 AI 生成。长文会消耗大量 token，请按需开启。",
  "settings.bgName": "后台预生成",
  "settings.bgDesc":
    "独立开关：无需打开挖空视图，切换到符合条件的笔记时就在后台预生成缓存，点开视图即可直接看到结果。",
  "settings.bgScopeName": "后台预生成范围",
  "settings.bgScopeDesc": "选择后台预生成适用哪些笔记，避免对所有笔记都消耗 token。",
  "settings.scopeAll": "全部笔记",
  "settings.scopeTag": "仅指定标签",
  "settings.scopeFolder": "仅指定文件夹",
  "settings.bgTagName": "后台预生成标签",
  "settings.bgTagDesc":
    "逗号分隔的标签（# 可省略，支持子标签前缀，如「学习」匹配「学习/xxx」）。留空则不预生成。",
  "settings.bgTagPlaceholder": "学习, 待复习",
  "settings.bgFolderName": "后台预生成文件夹",
  "settings.bgFolderDesc": "逗号分隔的文件夹路径（相对库根，如「03-领域/编程」）。留空则不预生成。",
  "settings.bgFolderPlaceholder": "03-领域, 05-学习",
  "settings.clearName": "清除全部记忆数据",
  "settings.clearDesc": "删除所有笔记的挖空缓存与复习进度（不会改动笔记文件）。",
  "settings.clearButton": "清空",
  "settings.footer": "当前库：{path} · 数据保存在插件 data.json",
  "notice.memoryCleared": "ai-cloze 记忆数据已清空",

  // provider preset labels
  "provider.openai": "OpenAI 兼容",
  "provider.anthropic": "Anthropic",
  "provider.ollama": "Ollama（本地）",

  // reading / review view
  "mode.read": "阅读挖空",
  "mode.review": "复习记忆",
  "tag.cacheHint": "读取上次 AI 生成结果；点击此按钮才会重新调用 AI",
  "tag.noCache": "尚无缓存",
  "tag.stale": "原文已修改",
  "tag.lastCloze": "上次挖空 · {model}",
  "tag.bgGenerating": "后台生成中…",
  "tag.notClozed": "未挖空",
  "tag.dueCount": "{count} 张到期",
  "toolbar.density": "挖空密度",
  "toolbar.regenerate": "重新 AI 挖空",
  "toolbar.revealAll": "显示全部",
  "toolbar.hideAll": "隐藏全部",
  "toolbar.backToDoc": "回到原文档",
  "status.mastered": "已掌握 {count}",
  "loading.bg": "正在后台生成挖空词…（完成后自动显示）",
  "loading.generate": "AI 正在分析并生成挖空词…",
  "empty.noResult": "这篇笔记还没有挖空结果。",
  "empty.noFile":
    "请先打开一篇 Markdown 笔记，再用命令面板运行「打开当前笔记的 AI 挖空阅读视图」。",
  "button.generate": "AI 智能挖空",
  "msg.aiEmpty": "AI 未返回有效挖空词，请检查 Provider 配置或重试",
  "msg.clozeDone": "AI 挖空完成，共 {count} 个知识点",
  "msg.autoCloze": "已开启自动挖空，正在调用 AI 生成（会消耗较多 token）…",
  "msg.noExport": "本次没有评分良好/简单的词可导出",
  "msg.exported": "已将 {count} 个词写入笔记闪卡区",
  "msg.connectionOk": "AI 连通成功",
  "msg.connectionFail": "连通失败",

  // review
  "grade.again": "再次",
  "grade.hard": "困难",
  "grade.good": "良好",
  "grade.easy": "简单",
  "review.noCards": "没有可复习的挖空词。请先回到阅读模式进行 AI 挖空。",
  "review.doneTitle": "本轮复习完成 🎉",
  "review.doneSummary": "共复习 {total} 个知识点，良好/简单 {mastered} 个。",
  "review.gradeSeq": "评分序列：{seq}",
  "review.autoUpdated": "已自动更新间隔记忆进度，到期后会自动进入复习队列。",
  "review.exportBtn": "导出已掌握为闪卡（==词== → 笔记）",
  "review.modeTag": "复习模式",
  "review.showAnswer": "显示答案",
  "review.gradeTip": "这个词记住了吗？",
  "review.thisGrades": "本次评分：{seq}",

  // AI errors
  "err.requestFailed": "AI 请求失败（HTTP {status}）：{err}",
  "err.noContent": "AI 返回内容缺失：choices[0].message.content 为空",
  "err.noText": "AI 返回内容缺失：content 无文本",
  "err.unknownProvider": "未知 Provider：{name}",

  // AI prompts
  "prompt.system":
    '你是记忆助手。用户会给一篇笔记的原文，你的任务是找出值得记忆的"关键知识点/关键短语"，用于制作挖空(cloze)阅读。\n\n要求：\n1. 只输出一个 JSON 对象，不要任何其它文字、不要 markdown 代码块围栏。\n2. JSON 格式：{"terms": [{"text": "关键短语", "importance": 8}, ...]}\n3. text 必须是笔记原文中真实出现的连续片段，通常 2-12 个字符（英文 1-4 个词）。\n4. importance 1-10 表示这个知识点的重要程度，越重要数字越大，用于控制挖空密度。\n5. 选取 10-40 个有代表性的知识点，覆盖全文重点，避免重复和无意义词（如"的、是、在"）。\n6. 不要包含 markdown 语法符号（如 #、*、[、]、|）。',
  "prompt.user": "以下是笔记原文，请分析并输出挖空候选：\n\n{text}",
  "prompt.truncated": "…（已截断）",
};

const en: Record<string, string> = {
  "cmd.openView": "Open AI Cloze reading view for current note",
  "cmd.openViewGenerate": "Open AI Cloze reading view (re-generate cloze)",
  "action.openView": "Open AI Cloze reading view",

  "view.display.withFile": "AI Cloze · {name}",
  "view.display.empty": "AI Cloze Reading",

  "notice.backgroundDone": "Generated cloze for \"{name}\" in background ({count} items)",
  "notice.backgroundFail": "Background cloze failed: {err}",

  "settings.title": "ai-cloze · AI Cloze Reading",
  "settings.languageName": "Language",
  "settings.languageDesc": "Interface language. Defaults to the Obsidian UI language.",
  "settings.languageSystem": "Follow system",
  "settings.providerName": "Provider",
  "settings.providerDesc":
    "Select an AI provider. OpenAI-compatible endpoints work with OpenAI / DeepSeek / Moonshot, etc.; Ollama is a local model.",
  "settings.baseUrlName": "API Base URL",
  "settings.baseUrlDesc":
    "OpenAI-compatible endpoint, e.g. https://api.openai.com/v1 or http://localhost:11434/v1 (Ollama)",
  "settings.apiKeyName": "API Key",
  "settings.apiKeyDesc": "Leave empty for local Ollama. The key is stored only in local data.json.",
  "settings.modelName": "Model",
  "settings.modelDesc": "e.g. gpt-4o-mini / claude-3-5-haiku-latest / qwen2.5:7b",
  "settings.tempName": "Temperature",
  "settings.tempDesc": "Lower is more stable. 0.1 - 0.5 recommended for cloze.",
  "settings.maxTokensName": "Max output tokens",
  "settings.maxTokensDesc": "Maximum tokens for the AI cloze list.",
  "settings.testName": "Test AI connectivity",
  "settings.testDesc":
    "Sends a minimal request to verify the API base URL, key, and model (uses almost no tokens).",
  "settings.testButton": "Test connection",
  "settings.testingButton": "Testing…",
  "settings.densityName": "Default cloze density",
  "settings.densityDesc":
    "0-100, the default cloze ratio on each open. Can be adjusted per-note in the reading view.",
  "settings.autoClozeName": "Auto cloze (on view open)",
  "settings.autoClozeDesc":
    "When enabled, opening the cloze view auto-calls AI if the note has no cache. Long notes consume many tokens; enable as needed.",
  "settings.bgName": "Background pre-generation",
  "settings.bgDesc":
    "Independent toggle: without opening the cloze view, switching to a matching note pre-generates its cache in the background.",
  "settings.bgScopeName": "Background pre-generation scope",
  "settings.bgScopeDesc": "Choose which notes get pre-generated, to avoid spending tokens on everything.",
  "settings.scopeAll": "All notes",
  "settings.scopeTag": "Only specified tags",
  "settings.scopeFolder": "Only specified folders",
  "settings.bgTagName": "Background pre-generation tags",
  "settings.bgTagDesc":
    "Comma-separated tags (# optional; supports sub-tag prefixes, e.g. \"Study\" matches \"Study/xxx\"). Empty disables.",
  "settings.bgTagPlaceholder": "Study, Review",
  "settings.bgFolderName": "Background pre-generation folders",
  "settings.bgFolderDesc":
    "Comma-separated folder paths relative to the vault root, e.g. \"03-Areas/Programming\". Empty disables.",
  "settings.bgFolderPlaceholder": "03-Areas, 05-Learning",
  "settings.clearName": "Clear all memory data",
  "settings.clearDesc": "Delete all cloze caches and review progress (does not modify note files).",
  "settings.clearButton": "Clear",
  "settings.footer": "Vault: {path} · Data stored in plugin data.json",
  "notice.memoryCleared": "ai-cloze memory data cleared",

  "provider.openai": "OpenAI Compatible",
  "provider.anthropic": "Anthropic",
  "provider.ollama": "Ollama (Local)",

  "mode.read": "Reading",
  "mode.review": "Review",
  "tag.cacheHint": "Uses last AI result; click to call AI again",
  "tag.noCache": "No cache",
  "tag.stale": "Source modified",
  "tag.lastCloze": "Last cloze · {model}",
  "tag.bgGenerating": "Generating in background…",
  "tag.notClozed": "Not clozed",
  "tag.dueCount": "{count} due",
  "toolbar.density": "Density",
  "toolbar.regenerate": "Re-generate cloze",
  "toolbar.revealAll": "Show all",
  "toolbar.hideAll": "Hide all",
  "toolbar.backToDoc": "Back to original note",
  "status.mastered": "Mastered {count}",
  "loading.bg": "Generating cloze in background… (will appear automatically)",
  "loading.generate": "AI is analyzing and generating cloze terms…",
  "empty.noResult": "This note has no cloze result yet.",
  "empty.noFile":
    "Open a Markdown note first, then run \"Open AI Cloze reading view for current note\" from the command palette.",
  "button.generate": "AI Cloze",
  "msg.aiEmpty": "AI returned no valid cloze terms. Check Provider config or retry.",
  "msg.clozeDone": "AI cloze complete: {count} items",
  "msg.autoCloze": "Auto-cloze enabled; calling AI now (uses tokens)…",
  "msg.noExport": "No terms rated Good/Simple to export.",
  "msg.exported": "Wrote {count} terms to the note's flashcard section",
  "msg.connectionOk": "AI connection successful",
  "msg.connectionFail": "Connection failed",

  "grade.again": "Again",
  "grade.hard": "Hard",
  "grade.good": "Good",
  "grade.easy": "Easy",
  "review.noCards": "No cloze terms to review. Run AI cloze in reading mode first.",
  "review.doneTitle": "Review complete 🎉",
  "review.doneSummary": "Reviewed {total} items; {mastered} rated Good/Simple.",
  "review.gradeSeq": "Grade sequence: {seq}",
  "review.autoUpdated": "Spaced-repetition progress updated; due cards will re-enter the queue.",
  "review.exportBtn": "Export mastered as flashcards (==word== → note)",
  "review.modeTag": "Review mode",
  "review.showAnswer": "Show answer",
  "review.gradeTip": "Did you remember this?",
  "review.thisGrades": "Grades: {seq}",

  "err.requestFailed": "AI request failed (HTTP {status}): {err}",
  "err.noContent": "AI returned no content: choices[0].message.content is empty",
  "err.noText": "AI returned no content: no text in content",
  "err.unknownProvider": "Unknown provider: {name}",

  "prompt.system":
    "You are a memory assistant. The user gives you the full text of a note. Your task is to find key knowledge points/phrases worth remembering, to build cloze reading.\n\nRequirements:\n1. Output only a single JSON object, no other text, no markdown code fences.\n2. JSON format: {\"terms\": [{\"text\": \"key phrase\", \"importance\": 8}, ...]}\n3. text must be a contiguous fragment that actually appears in the note, usually 2-12 characters (1-4 English words).\n4. importance 1-10 indicates how important the point is; higher means more important, used to control cloze density.\n5. Select 10-40 representative points covering the whole text; avoid duplicates and meaningless words (like \"the\", \"and\", \"is\").\n6. Do not include markdown syntax characters (such as #, *, [, ], |).",
  "prompt.user": "Here is the note content. Analyze it and output cloze candidates:\n\n{text}",
  "prompt.truncated": "… (truncated)",
};

/** 替换 {key} 占位符 */
function fill(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) =>
    k in params ? String(params[k]) : m
  );
}

export function t(
  key: string,
  params?: Record<string, string | number>
): string {
  const dict = locale === "zh" ? zh : en;
  const template = dict[key] ?? (locale === "zh" ? en[key] : zh[key]) ?? key;
  return fill(template, params);
}
