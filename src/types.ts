export type ProviderKind = "openai" | "anthropic" | "ollama";

export interface ProviderSettings {
  provider: ProviderKind;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  /** 是否在浏览器跨域受限时走本机中继（预留，暂未启用） */
  useProxy: boolean;
}

export interface ClozeTerm {
  /** 挖空短语（须为原文中真实出现的片段） */
  text: string;
  /** 重要性 1-10，用于密度排序 */
  importance: number;
}

/** 每篇笔记的 AI 挖空缓存：下次打开直接读取，除非点「重新AI挖空」 */
export interface NoteClozeCache {
  /** 生成时的原文全文 */
  source: string;
  /** 原文哈希，用于检测笔记是否已变化 */
  sourceHash: string;
  /** AI 生成的候选挖空词（按 importance 降序） */
  terms: ClozeTerm[];
  /** 本次使用的挖空密度 0-100 */
  density: number;
  /** 生成时间戳 */
  createdAt: number;
  /** 使用的模型（便于追溯） */
  model: string;
}

/** 单个复习卡：SM-2 记忆状态，key = `${path}::${term}` */
export interface ReviewCard {
  path: string;
  term: string;
  /** 最近一次评分 0=再次 1=困难 2=良好 3=简单 */
  lastGrade: number;
  /** 间隔天数 */
  interval: number;
  /** 简易度因子（初始 2.5） */
  ease: number;
  /** 复习次数 */
  reps: number;
  /** 遗忘次数 */
  lapses: number;
  /** 下次到期时间戳(ms) */
  due: number;
  /** 是否已确认掌握（良好/简单 且 reps>=2） */
  mastered: boolean;
}

export interface AIClozeData {
  provider: ProviderSettings;
  defaultDensity: number;
  /** 打开挖空视图时是否自动调用 AI 挖空（仅影响视图内行为，会消耗 token） */
  autoCloze: boolean;
  /** 是否后台预生成挖空（独立开关：无需打开挖空视图，切到笔记即预生成） */
  backgroundCloze: boolean;
  /** 后台预生成范围：全部笔记 / 仅含指定标签 / 仅指定文件夹 */
  backgroundScope: "all" | "tag" | "folder";
  /** backgroundScope=tag 时生效的标签列表（# 可选，支持子标签前缀匹配） */
  backgroundTags: string[];
  /** backgroundScope=folder 时生效的文件夹路径列表 */
  backgroundFolders: string[];
  clozeCache: Record<string, NoteClozeCache>;
  review: Record<string, ReviewCard>;
}
