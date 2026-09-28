// Test entry: mount ReadingMode with real renderMarkdownWithCloze + stub obsidian
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { ReadingMode } from "../src/components/ReadingMode";
import { MarkdownRenderer, ItemView, TFile } from "obsidian";
import type { ClozeTerm } from "../src/types";

export interface MountOpts {
  source: string;
  terms: ClozeTerm[];
  masked: string[];
  revealed: string[];
  onToggleTerm: (term: string) => void;
}

export interface Mounted {
  el: HTMLDivElement;
  click: (index: number) => void;
  destroy: () => void;
  renderCalls: () => number;
}

export async function mount(opts: MountOpts): Promise<Mounted> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  MarkdownRenderer.renderCalls = 0;

  const file = new TFile("a/b/note.md");
  const view = new ItemView();
  root.render(
    createElement(ReadingMode, {
      view,
      file,
      source: opts.source,
      terms: opts.terms,
      masked: new Set(opts.masked),
      revealed: new Set(opts.revealed),
      onToggleTerm: opts.onToggleTerm,
    })
  );

  // 等 React 提交 + markdown 渲染 effect 完成
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, 0);
  await promise;
  const md = host.querySelector<HTMLDivElement>(".ac-markdown");
  if (!md) throw new Error("ac-markdown not mounted");
  return {
    el: md,
    click: (index: number) => {
      const spans = md.querySelectorAll<HTMLElement>(".ac-cloze.ac-masked");
      const span = spans[index];
      if (!span) throw new Error(`no masked cloze at index ${index}`);
      span.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    },
    destroy: () => {
      root.unmount();
      host.remove();
    },
    renderCalls: () => MarkdownRenderer.renderCalls,
  };
}
