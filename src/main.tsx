import { ItemView, MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, AIClozeSettingTab } from "./settings";
import type { AIClozeData } from "./types";
import { generateClozeTerms, hashText } from "./cloze";
import { ClozeView, VIEW_TYPE_AI_CLOZE } from "./view";

export default class AIClozePlugin extends Plugin {

  settings!: AIClozeData;

  /** 正在后台生成挖空的笔记路径（去重，避免重复并发调用） */
  public generatingPaths = new Set<string>();

  /** 后台生成结束（成功/失败/无结果）时的订阅者 */
  private backgroundDoneHandlers = new Set<(path: string) => void>();

  /** 订阅后台生成完成事件，返回取消订阅函数 */
  public onBackgroundDone(handler: (path: string) => void): () => void {
    this.backgroundDoneHandlers.add(handler);
    return () => this.backgroundDoneHandlers.delete(handler);
  }

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    this.registerView(VIEW_TYPE_AI_CLOZE, (leaf) => new ClozeView(leaf, this));

    this.addCommand({
      id: "open-cloze-view",
      name: "打开当前笔记的 AI 挖空阅读视图",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) void this.openClozeView(file);
        return true;
      },
    });

    this.addCommand({
      id: "open-cloze-view-and-generate",
      name: "打开 AI 挖空阅读视图（重新 AI 挖空）",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) void this.openClozeView(file, { forceGenerate: true });
        return true;
      },
    });

    this.addSettingTab(new AIClozeSettingTab(this.app, this));

    // 给 markdown 阅读/编辑视图头部加「AI 挖空」跳转按钮
    this.registerEvent(this.app.workspace.on("layout-change", () => this.ensureDocButton()));
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.ensureDocButton();
        void this.generateInBackground(this.app.workspace.getActiveFile());
      })
    );
    this.ensureDocButton();
    // 启动时为当前笔记后台预生成（若开启后台预生成）
    void this.generateInBackground(this.app.workspace.getActiveFile());
  }

  /**
   * 后台自动挖空：尚未打开挖空视图时，提前为当前笔记生成缓存，
   * 这样用户点开 AI 挖空视图即可直接看到结果，无需在视图里再等 AI。
   * 由独立的「后台预生成」开关 + 范围（全部/标签/文件夹）控制。
   */
  async generateInBackground(file: TFile | null): Promise<void> {
    if (!file || !this.settings.backgroundCloze) return;
    const path = file.path;
    if (this.generatingPaths.has(path)) return;
    if (this.settings.clozeCache[path]) return;
    if (!this.matchesBackgroundScope(file)) return;
    this.generatingPaths.add(path);
    try {
      const text = await this.app.vault.cachedRead(file);
      const terms = await generateClozeTerms(this.settings.provider, text);
      if (terms.length === 0) return;
      this.settings.clozeCache[path] = {
        source: text,
        sourceHash: hashText(text),
        terms,
        density: this.settings.defaultDensity,
        createdAt: Date.now(),
        model: this.settings.provider.model,
      };
      await this.saveData(this.settings);
      new Notice(`已后台生成「${file.basename}」挖空（${terms.length} 个知识点）`);
    } catch (e) {
      new Notice(`后台挖空失败：${e instanceof Error ? e.message : String(e)}`, 8000);
    } finally {
      this.generatingPaths.delete(path);
      for (const handler of this.backgroundDoneHandlers) handler(path);
    }
  }

  /** 判断某笔记是否属于「后台预生成」范围 */
  private matchesBackgroundScope(file: TFile): boolean {
    const scope = this.settings.backgroundScope;
    if (scope === "folder") {
      const folders = this.settings.backgroundFolders.map((f) => f.trim().replace(/^\/+|\/+$/g, "")).filter(Boolean);
      if (folders.length === 0) return false;
      const dir = file.parent?.path ?? "";
      return folders.some((f) => dir === f || dir.startsWith(`${f}/`));
    }
    if (scope === "tag") {
      const wanted = this.settings.backgroundTags.map((t) => t.trim().replace(/^#/, "")).filter(Boolean);
      if (wanted.length === 0) return false;
      const cache = this.app.metadataCache.getFileCache(file);
      const tags: string[] = [];
      for (const t of cache?.tags ?? []) tags.push(t.tag.replace(/^#/, ""));
      const fm = cache?.frontmatter?.tags;
      if (typeof fm === "string") tags.push(fm.replace(/^#/, ""));
      else if (Array.isArray(fm)) tags.push(...fm.map((x) => String(x).replace(/^#/, "")));
      return wanted.some((w) => tags.some((t) => t === w || t.startsWith(`${w}/`)));
    }
    return true;
  }

  /** 已加过按钮的 markdown 视图（视图实例复用，避免重复添加） */
  private docButtonViews = new WeakSet<MarkdownView>();
  private docButtonEls: HTMLElement[] = [];

  private ensureDocButton(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || this.docButtonViews.has(view)) return;
    this.docButtonViews.add(view);
    const el = view.addAction("target", "打开 AI 挖空阅读视图", () => {
      const file = view.file;
      if (file) void this.openClozeView(file);
    });
    this.docButtonEls.push(el);
  }

  async openClozeView(file: TFile, opts?: { forceGenerate?: boolean }) {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_AI_CLOZE)[0];
    const leaf: WorkspaceLeaf = existing ?? this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: VIEW_TYPE_AI_CLOZE,
      active: true,
      state: { file: file.path, forceGenerate: opts?.forceGenerate ?? false },
    });
    await this.app.workspace.revealLeaf(leaf);
  }

  onunload() {
    this.docButtonEls.forEach((el) => el.remove());
    this.app.workspace.getLeavesOfType(VIEW_TYPE_AI_CLOZE).forEach((leaf) => leaf.detach());
  }
}

export { ClozeView, VIEW_TYPE_AI_CLOZE };
