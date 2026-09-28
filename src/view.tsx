import { ItemView, MarkdownRenderer, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";
import { createElement } from "react";
import { createRoot, Root } from "react-dom/client";
import { App } from "./components/App";
import type AIClozePlugin from "./main";
import type { ClozeTerm } from "./types";
import { wrapClozeTerms } from "./dom";

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
    return file ? `AI 挖空 · ${file.basename}` : "AI 挖空阅读";
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

  /** 跳回原文档：已打开的 leaf 直接激活，否则新开 tab */
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
 * 供组件使用的渲染工具：渲染 markdown 并包上挖空。
 * 返回被包裹的 span 列表，便于调用方维护 term→span 映射以做原地类名切换。
 * isStale 用于竞态防护：发起新的渲染后，旧渲染的空/包装步骤会跳过，
 * 避免旧的异步结果污染新 DOM。
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
