import type { ClozeTerm } from "./types";

// Skip directly by tag name: links, code, preformatted, script, math, SVG figures, form controls
const SKIP_TAGS: Record<string, true> = {
  A: true, CODE: true, PRE: true, SCRIPT: true, STYLE: true, "MJX-CONTAINER": true,
  SVG: true, TEXT: true, TSPAN: true, MATH: true, IMG: true,
  INPUT: true, SELECT: true, TEXTAREA: true, BUTTON: true, OPTION: true,
};

/**
 * Determines whether a text node should be skipped.
 * Besides the direct parent tag, it also handles text nested inside links/code/math/SVG
 * (e.g. `<a><strong>word</strong></a>`, `<code><em>word</em></code>`),
 * to avoid breaking the structure or interactivity of these elements.
 */
function isSkippable(el: HTMLElement): boolean {
  if (SKIP_TAGS[el.tagName]) return true;
  return el.closest("a, code, pre, svg, .mjx-container, .MathJax, .block-language-dataview, .ac-cloze") !== null;
}

/**
 * Wraps the given phrases into cloze spans in the rendered markdown DOM.
 * Only processes plain text nodes (skipping links/code/preformatted/math/SVG) to avoid breaking markdown structure.
 * Returns the list of wrapped spans.
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
      // find the earliest occurrence of any phrase
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
 * Updates span class names in place according to the cloze state (no DOM rebuild, avoiding flicker).
 * If masked, shows the answer per `revealed`; otherwise removes all state classes.
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
