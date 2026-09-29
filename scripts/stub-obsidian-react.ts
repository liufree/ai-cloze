// obsidian stub for ReadingMode/ReviewMode render test: renders markdown → simple DOM
export const getLanguage = () => "en";
export const requestUrl = async () => {
  throw new Error("stub requestUrl");
};

export class MarkdownRenderer {
  static renderCalls = 0;
  static async render(app: unknown, markdown: string, el: HTMLElement, sourcePath: string, component: unknown): Promise<void> {
    MarkdownRenderer.renderCalls += 1;
    el.empty();
    const html = markdown
      .replace(/^## (.*)$/gm, "<h2>$1</h2>")
      .replace(/^([^\n#|]+)$/gm, "<p>$1</p>");
    el.innerHTML = html;
    await Promise.resolve();
  }
  static renderMarkdown(): void {}
}
export class TFile {
  path: string;
  basename: string;
  constructor(path: string) {
    this.path = path;
    this.basename = path.split("/").pop()!.replace(/\.md$/, "");
  }
}
export class ItemView {}
export class MarkdownView {}
export class WorkspaceLeaf {}
