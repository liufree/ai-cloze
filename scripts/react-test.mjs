// React 组件级验证：ReadingMode 点击挖空词 → 原地切类名，不重渲染整页（修复闪烁）
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, "dist/react-test.cjs");
mkdirSync(dirname(out), { recursive: true });

// jsdom 全局需在加载 react-dom 之前就位
const { JSDOM } = await import("jsdom");
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.Node = dom.window.Node;
globalThis.NodeFilter = dom.window.NodeFilter;
globalThis.HTMLElement = dom.window.HTMLElement;
// Obsidian 扩展的 DOM 便捷方法（empty），jsdom 没有
dom.window.HTMLElement.prototype.empty = function empty() {
  this.textContent = "";
};
globalThis.MouseEvent = dom.window.MouseEvent;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await build({
  entryPoints: [join(root, "scripts/react-entry.tsx")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: out,
  jsx: "automatic",
  alias: { obsidian: join(root, "scripts/stub-obsidian-react.ts") },
  logLevel: "silent",
});

let pass = 0;
let fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}

const { mount } = await import(out);

// 等 React effect 完成初次渲染
await new Promise((r) => setTimeout(r, 50));

{
  const toggled = [];
  const m = await mount({
    source: "## 标题\n内存是重要概念，内存又分主存。",
    terms: [
      { text: "内存", importance: 9 },
      { text: "主存", importance: 7 },
    ],
    masked: ["内存", "主存"],
    revealed: [],
    onToggleTerm: (t) => toggled.push(t),
  });
  await new Promise((r) => setTimeout(r, 50));

  const before = m.el.querySelectorAll(".ac-cloze.ac-masked").length;
  const firstSpan = m.el.querySelector(".ac-cloze.ac-masked");
  ok(before === 3, `初次渲染挖空 3 处（两处内存+一处主存）`);
  const callsAfterMount = m.renderCalls();
  ok(callsAfterMount === 1, `初次渲染只调用 MarkdownRenderer.render 一次 (${callsAfterMount})`);

  // 点击第一个挖空词：只应切类名，不应触发整页重渲染
  m.click(0);
  await new Promise((r) => setTimeout(r, 50));
  ok(m.renderCalls() === callsAfterMount, `点击挖空词不触发整页重渲染（render 次数不变 ${m.renderCalls()}）`);
  ok(firstSpan?.classList.contains("ac-revealed"), "点击后该词原地显示答案");
  ok(toggled.length === 1 && toggled[0] === "内存", "React 状态同步切换该词");
  ok(m.el.querySelectorAll(".ac-cloze.ac-masked").length === before, "DOM 未重建，挖空 span 数量不变");
  ok(m.el.querySelector("h2") !== null, "整页 DOM 保留（标题仍在）");

  // 再点同一词：隐藏答案
  m.click(0);
  await new Promise((r) => setTimeout(r, 50));
  ok(!firstSpan?.classList.contains("ac-revealed"), "再次点击隐藏答案");
  ok(m.renderCalls() === callsAfterMount, "隐藏也不触发重渲染");

  // 点击第二个词（主存）
  m.click(1);
  await new Promise((r) => setTimeout(r, 50));
  const spans = m.el.querySelectorAll(".ac-cloze.ac-masked");
  ok(spans[1]?.classList.contains("ac-revealed"), "点击其它挖空词单独显示，不影响其它");
  ok(!spans[0]?.classList.contains("ac-revealed") && !spans[2]?.classList.contains("ac-revealed"), "其余挖空词不受影响");
  ok(m.renderCalls() === callsAfterMount, "多次点击全程零重渲染");

  m.destroy();
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
