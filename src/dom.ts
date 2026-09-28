import type { ClozeTerm } from "./types";

// 直接按标签名跳过：链接、代码、预格式、脚本、数学、SVG 图、表单控件
const SKIP_TAGS: Record<string, true> = {
  A: true, CODE: true, PRE: true, SCRIPT: true, STYLE: true, "MJX-CONTAINER": true,
  SVG: true, TEXT: true, TSPAN: true, MATH: true, IMG: true,
  INPUT: true, SELECT: true, TEXTAREA: true, BUTTON: true, OPTION: true,
};

/**
 * 判断文本节点是否应被跳过。
 * 除了直接父标签，还要处理文本被嵌套进链接/代码/数学/SVG 内的情况
 * （如 `<a><strong>词</strong></a>`、`<code><em>词</em></code>`），
 * 避免破坏这些元素的结构或交互。
 */
function isSkippable(el: HTMLElement): boolean {
  if (SKIP_TAGS[el.tagName]) return true;
  return el.closest("a, code, pre, svg, .mjx-container, .MathJax, .block-language-dataview, .ac-cloze") !== null;
}

/**
 * 在渲染后的 markdown DOM 中把指定短语包装成挖空 span。
 * 只处理纯文本节点（跳过链接/代码/预格式/数学/SVG），避免破坏 markdown 结构。
 * 返回被包裹的 span 列表。
 */
export function wrapClozeTerms(
  root: HTMLElement,
  terms: ClozeTerm[],
  masked: Set<string>,
  revealed: Set<string>
): HTMLSpanElement[] {
  const wrapped: HTMLSpanElement[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const parent = n.parentElement;
    if (parent && isSkippable(parent)) continue;
    textNodes.push(n as Text);
  }

  for (const node of textNodes) {
    const text = node.nodeValue || "";
    let changed = false;
    const frag = document.createDocumentFragment();
    let cursor = 0;
    let idx = 0;
    while (idx < text.length) {
      // 找最早出现的任一短语
      let bestTerm: ClozeTerm | null = null;
      let bestAt = -1;
      for (const t of terms) {
        const at = text.indexOf(t.text, idx);
        if (at !== -1 && (bestAt === -1 || at < bestAt)) {
          bestAt = at;
          bestTerm = t;
        }
      }
      if (!bestTerm || bestAt === -1) break;
      if (bestAt > cursor) {
        frag.appendChild(document.createTextNode(text.slice(cursor, bestAt)));
      }
      const span = document.createElement("span");
      span.className = "ac-cloze";
      span.dataset.term = bestTerm.text;
      if (masked.has(bestTerm.text)) {
        span.classList.add("ac-masked");
        if (revealed.has(bestTerm.text)) span.classList.add("ac-revealed");
      }
      span.textContent = bestTerm.text;
      span.setAttribute("data-importance", String(bestTerm.importance));
      frag.appendChild(span);
      wrapped.push(span);
      cursor = bestAt + bestTerm.text.length;
      idx = cursor;
      changed = true;
    }
    if (changed && cursor < text.length) {
      frag.appendChild(document.createTextNode(text.slice(cursor)));
    }
    if (changed) {
      node.parentNode?.replaceChild(frag, node);
    }
  }
  return wrapped;
}

/**
 * 根据挖空状态原地更新 span 的类名（不重建 DOM，避免闪烁）。
 * 若已挖空则按 revealed 决定是否显示答案；未挖空则移除所有状态类。
 */
export function applyCloakClasses(
  spans: Iterable<HTMLSpanElement>,
  masked: Set<string>,
  revealed: Set<string>
): void {
  for (const span of spans) {
    const term = span.dataset.term;
    if (!term) continue;
    const isMasked = masked.has(term);
    span.classList.toggle("ac-masked", isMasked);
    span.classList.toggle("ac-revealed", isMasked && revealed.has(term));
  }
}
