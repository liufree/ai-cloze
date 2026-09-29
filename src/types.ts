export type ProviderKind = "openai" | "anthropic" | "ollama";

export interface ProviderSettings {
  provider: ProviderKind;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  /** Whether to route through a local relay when the browser is cross-origin restricted (reserved, not yet enabled) */
  useProxy: boolean;
}

export interface ClozeTerm {
  /** Cloze phrase (must be a snippet that actually appears in the source text) */
  text: string;
  /** Importance 1-10, used for density ordering */
  importance: number;
}

/** Per-note AI cloze cache: read directly on next open unless "re-AI-cloze" is triggered */
export interface NoteClozeCache {
  /** Full source text at generation time */
  source: string;
  /** Source hash, used to detect whether the note has changed */
  sourceHash: string;
  /** AI-generated candidate cloze terms (sorted by importance descending) */
  terms: ClozeTerm[];
  /** Cloze density used for this run, 0-100 */
  density: number;
  /** Generation timestamp */
  createdAt: number;
  /** Model used (for traceability) */
  model: string;
}

/** Single review card: SM-2 memory state, key = `${path}::${term}` */
export interface ReviewCard {
  path: string;
  term: string;
  /** Most recent grade 0=again 1=hard 2=good 3=easy */
  lastGrade: number;
  /** Interval in days */
  interval: number;
  /** Ease factor (initially 2.5) */
  ease: number;
  /** Review count */
  reps: number;
  /** Lapse count */
  lapses: number;
  /** Next due timestamp (ms) */
  due: number;
  /** Whether it's been confirmed as mastered (good/easy and reps>=2) */
  mastered: boolean;
}

export interface AIClozeData {
  provider: ProviderSettings;
  defaultDensity: number;
  /** UI language: system=follow Obsidian's UI language, zh=Chinese, en=English */
  language: "system" | "zh" | "en";
  /** Whether to automatically call AI cloze when opening the cloze view (only affects in-view behavior; consumes tokens) */
  autoCloze: boolean;
  /** Whether to pre-generate cloze in the background (independent toggle: pre-generates on switching to a note without opening the cloze view) */
  backgroundCloze: boolean;
  /** Background pre-generation scope: all notes / only notes with specified tags / only specified folders */
  backgroundScope: "all" | "tag" | "folder";
  /** Tag list active when backgroundScope=tag (# optional; supports sub-tag prefix matching) */
  backgroundTags: string[];
  /** Folder path list active when backgroundScope=folder */
  backgroundFolders: string[];
  clozeCache: Record<string, NoteClozeCache>;
  review: Record<string, ReviewCard>;
}
