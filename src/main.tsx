import { ItemView, MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, AIClozeSettingTab } from "./settings";
import type { AIClozeData } from "./types";
import { generateClozeTerms, hashText } from "./cloze";
import { ClozeView, VIEW_TYPE_AI_CLOZE } from "./view";
import { applyLanguage, t } from "./i18n";

export default class AIClozePlugin extends Plugin {

  settings!: AIClozeData;

  /** Note paths currently being cloze-generated in the background (deduplicated to avoid duplicate concurrent calls) */
  public generatingPaths = new Set<string>();

  /** Subscribers notified when background generation finishes (success/failure/no result) */
  private backgroundDoneHandlers = new Set<(path: string) => void>();

  /** Subscribe to background-generation-complete events; returns an unsubscribe function */
  public onBackgroundDone(handler: (path: string) => void): () => void {
    this.backgroundDoneHandlers.add(handler);
    return () => this.backgroundDoneHandlers.delete(handler);
  }

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    applyLanguage(this.settings.language);

    this.registerView(VIEW_TYPE_AI_CLOZE, (leaf) => new ClozeView(leaf, this));

    this.addCommand({
      id: "open-cloze-view",
      name: t("cmd.openView"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) void this.openClozeView(file);
        return true;
      },
    });

    this.addCommand({
      id: "open-cloze-view-and-generate",
      name: t("cmd.openViewGenerate"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) void this.openClozeView(file, { forceGenerate: true });
        return true;
      },
    });

    this.addSettingTab(new AIClozeSettingTab(this.app, this));

    // add an "AI Cloze" jump button to the header of markdown reading/editing views
    this.registerEvent(this.app.workspace.on("layout-change", () => this.ensureDocButton()));
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.ensureDocButton();
        void this.generateInBackground(this.app.workspace.getActiveFile());
      })
    );
    this.ensureDocButton();
    // background-pre-generate the current note on startup (if background generation is enabled)
    void this.generateInBackground(this.app.workspace.getActiveFile());
  }

  /**
   * Background auto-clozing: while the cloze view isn't open, generates a cache for the current note in advance,
   * so the user immediately sees results when opening the AI cloze view instead of waiting for the AI inside it.
   * Controlled by a separate "background pre-generation" toggle plus a scope (all/tag/folder).
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
      new Notice(t("notice.backgroundDone", { name: file.basename, count: terms.length }));
    } catch (e) {
      new Notice(t("notice.backgroundFail", { err: e instanceof Error ? e.message : String(e) }), 8000);
    } finally {
      this.generatingPaths.delete(path);
      for (const handler of this.backgroundDoneHandlers) handler(path);
    }
  }

  /** Determine whether a note falls within the "background pre-generation" scope */
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

  /** Markdown views that already have a button added (view instances are reused to avoid duplicate additions) */
  private docButtonViews = new WeakSet<MarkdownView>();
  private docButtonEls: HTMLElement[] = [];

  private ensureDocButton(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || this.docButtonViews.has(view)) return;
    this.docButtonViews.add(view);
    const el = view.addAction("target", t("action.openView"), () => {
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
