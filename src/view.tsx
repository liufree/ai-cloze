import { ItemView, MarkdownRenderer, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";
import { createElement } from "react";
import { createRoot, Root } from "react-dom/client";
import { App } from "./components/App";
import type AIClozePlugin from "./main";
import type { ClozeTerm } from "./types";
import { wrapClozeTerms } from "./dom";
import { t } from "./i18n";

export const VIEW_TYPE_AI_CLOZE = "ai-cloze-view";

export interface ClozeViewState extends Record<string, unknown> {
  file: string;
  forceGenerate?: boolean;
}

export class ClozeView extends ItemView {
  plugin: AIClozePlugin;
  private root: Root | null = null;
  state: ClozeViewState = { file: "" };
  private container!: HTMLDivElement;

  constructor(leaf: WorkspaceLeaf, plugin: AIClozePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_AI_CLOZE;
  }

  getDisplayText(): string {
    const file = this.getFile();
    return file ? t("view.display.withFile", { name: file.basename }) : t("view.display.empty");
  }

  getIcon(): string {
    return "target";
  }

  getState(): ClozeViewState {
    return this.state;
  }

  async setState(state: ClozeViewState, result: unknown): Promise<void> {
    this.state = state;
    result;
    await this.refresh();
  }

  getFile(): TFile | null {
    const f = this.state.file ? this.app.vault.getAbstractFileByPath(this.state.file) : null;
    return f instanceof TFile ? f : null;
  }

  /** Jump back to the source document: activate an already-open leaf, otherwise open a new tab */
  async openOriginal(): Promise<void> {
    const file = this.getFile();
    if (!file) return;
    const existing = this.app.workspace
      .getLeavesOfType("markdown")
      .find((leaf) => leaf.view instanceof MarkdownView && leaf.view.file?.path === file.path);
    const leaf = existing ?? this.app.workspace.getLeaf("tab");
    await leaf.openFile(file);
    await this.app.workspace.revealLeaf(leaf);
  }

  async onOpen(): Promise<void> {
    this.container = this.contentEl.createDiv({ cls: "ac-root" });
    this.root = createRoot(this.container);
    this.root.render(
      createElement(App, { plugin: this.plugin, view: this })
    );
    await this.refresh();
  }

  async refresh(): Promise<void> {
    if (this.root) {
      this.root.render(
        createElement(App, { plugin: this.plugin, view: this })
      );
    }
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }
}

/**
 * Rendering utility for components: renders markdown and wraps cloze terms.
 * Returns the list of wrapped spans so callers can keep a term→span map for in-place class toggling.
 * `isStale` guards against races: once a new render is started, the clearing/wrapping steps of an old
 * render are skipped so stale async results don't pollute the new DOM.
 */
export async function renderMarkdownWithCloze(
  el: HTMLElement,
  markdown: string,
  file: TFile,
  view: ItemView,
  terms: ClozeTerm[],
  masked: Set<string>,
  revealed: Set<string>,
  isStale?: () => boolean
): Promise<HTMLSpanElement[]> {
  if (isStale?.()) return [];
  el.empty();
  if (isStale?.()) return [];
  await MarkdownRenderer.render(view.app, markdown, el, file.path, view);
  if (isStale?.()) return [];
  return wrapClozeTerms(el, terms, masked, revealed);
}
