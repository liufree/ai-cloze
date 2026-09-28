// 纯逻辑冒烟测试：打包真实源码，模拟 DOM + 校验挖空/解析/密度/SRS
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, "dist/smoke.cjs");
mkdirSync(dirname(out), { recursive: true });

// obsidian 只用到 requestUrl；为让 cloze.ts 可在 node 加载，用桩替换
await build({
  entryPoints: [join(root, "scripts/smoke-entry.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: out,
  alias: { obsidian: join(root, "scripts/stub-obsidian.ts") },
  logLevel: "silent",
});

const mod = await import(out);

let pass = 0;
let fail = 0;
function ok(cond, name) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}`);
  }
}

// 1. extractJson：容忍代码块围栏与前后杂讯
{
  const raw = "好的，结果如下：\n```json\n{\"terms\":[{\"text\":\"挖空\",\"importance\":9}]}\n```\n完毕";
  const j = mod.extractJson(raw);
  ok(j && j.terms && j.terms[0].text === "挖空", "extractJson 解析围栏 JSON");
}
// 2. normalizeTerms：过滤空/带符号/去重/重要性排序
{
  const terms = mod.normalizeTerms({
    terms: [
      { text: "低", importance: 1 },
      { text: "高", importance: 9 },
      { text: "高", importance: 9 },
      { text: "  " },
      { text: "带#符号", importance: 5 },
      { text: 123 },
    ],
  });
  ok(terms.length === 2, "normalizeTerms 去重过滤");
  ok(terms[0].text === "高" && terms[1].text === "低", "normalizeTerms 按重要性降序");
}
// 3. pickMasked 密度
{
  const terms = mod.normalizeTerms({ terms: Array.from({ length: 10 }, (_, i) => ({ text: `词${i}`, importance: i })) });
  const m50 = mod.pickMasked(terms, 50);
  ok(m50.size === 5, "密度50%挖空5/10");
  const m0 = mod.pickMasked(terms, 0);
  ok(m0.size === 1, "密度0%至少挖1个");
  const m100 = mod.pickMasked(terms, 100);
  ok(m100.size === 10, "密度100%全挖");
}
// 4. hashText 稳定 + 变化敏感
{
  const a = mod.hashText("hello");
  ok(a === mod.hashText("hello"), "hashText 稳定");
  ok(a !== mod.hashText("hello!"), "hashText 变化敏感");
}
// 5. prepareNoteText 去 frontmatter + 截断
{
  const t = mod.prepareNoteText("---\ntags: [x]\n---\n正文", 100);
  ok(!t.includes("tags:"), "prepareNoteText 去 frontmatter");
  const long = mod.prepareNoteText("x".repeat(200), 100);
  ok(long.length <= 120, "prepareNoteText 截断");
}
// 6. SRS：初次良好 interval=1；再次 interval=1 且 lapses 增加；掌握需 reps>=2
{
  const base = { path: "a.md", term: "t", lastGrade: 0, interval: 0, ease: 2.5, reps: 0, lapses: 0, due: Date.now(), mastered: false };
  const g2 = mod.reviewCard(base, 2);
  ok(g2.interval === 1 && g2.reps === 1 && !g2.mastered, "SRS 首次良好 interval=1 未掌握");
  const g2b = mod.reviewCard(g2, 2);
  ok(g2b.interval === 3 && g2b.mastered, "SRS 二次良好 interval=3 已掌握");
  const fail = mod.reviewCard(base, 0);
  ok(fail.lapses === 1 && fail.interval === 1, "SRS 再次 lapses+1 interval=1");
  const due = mod.isDue({ ...base, due: Date.now() - 1 });
  ok(due === true, "isDue 到期判定");
}
// 7. dom：wrapClozeTerms 用 jsdom 校验真实挖空包装
{
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<div id='root'></div>");
  globalThis.document = dom.window.document;
  globalThis.NodeFilter = dom.window.NodeFilter;
  globalThis.Node = dom.window.Node;
  globalThis.HTMLElement = dom.window.HTMLElement;

  const root = dom.window.document.getElementById("root");
  root.innerHTML = "<p>内存是重要的概念，内存又分主存。</p><code>内存</code>";
  const terms = [
    { text: "内存", importance: 9 },
    { text: "主存", importance: 7 },
  ];
  const masked = new Set(["内存", "主存"]);
  const spans = mod.wrapClozeTerms(root, terms, masked, new Set());
  // 段落内 "内存" 出现 2 次 + "主存" 1 次 = 3 处；code 内被跳过
  ok(spans.length === 3, "wrapClozeTerms 包中正文三处（跳过 code 内）");
  ok(root.querySelector("code .ac-cloze") === null, "wrapClozeTerms 跳过 code 块");
  const maskedSpans = root.querySelectorAll(".ac-cloze.ac-masked");
  ok(maskedSpans.length === 3, "挖空 span 带 ac-masked 类");

  // 生产环境每次 markdown 都重新渲染后重新包装，此处模拟同样的重置
  root.innerHTML = "<p>内存是重要的概念，内存又分主存。</p><code>内存</code>";
  const spans2 = mod.wrapClozeTerms(root, terms, masked, new Set(["内存"]));
  ok(spans2.filter((s) => s.classList.contains("ac-revealed")).length === 2, "revealed 词显示答案（两处内存）");
}
// 8. dom：applyCloakClasses 原地切换类名，不重建 DOM（修复点击闪烁的核心）
{
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<div id='root'></div>");
  globalThis.document = dom.window.document;
  globalThis.NodeFilter = dom.window.NodeFilter;
  globalThis.Node = dom.window.Node;
  globalThis.HTMLElement = dom.window.HTMLElement;

  const root = dom.window.document.getElementById("root");
  root.innerHTML = "<p>内存是重要概念。</p>";
  const terms = [{ text: "内存", importance: 9 }];
  const masked = new Set(["内存"]);
  const spans = mod.wrapClozeTerms(root, terms, masked, new Set());
  const spanEl = spans[0];
  ok(spanEl.classList.contains("ac-masked") && !spanEl.classList.contains("ac-revealed"), "初始已挖空未揭示");

  // 点击揭示：只改类名，DOM 节点不变
  mod.applyCloakClasses(spans, masked, new Set(["内存"]));
  ok(spanEl.isConnected, "揭示后 span 仍留在文档中（未重建）");
  ok(spanEl.classList.contains("ac-revealed"), "揭示后带 ac-revealed");

  // 再点隐藏：类名被移除
  mod.applyCloakClasses(spans, masked, new Set());
  ok(!spanEl.classList.contains("ac-revealed"), "再次点击移除 ac-revealed");

  // 密度调整导致不再挖空：移除状态类，span 还原为普通文本外观
  mod.applyCloakClasses(spans, new Set(), new Set());
  ok(!spanEl.classList.contains("ac-masked") && !spanEl.classList.contains("ac-revealed"), "未挖空时移除状态类");
}
// 9. dom：元素类型审计——表格/dataview/数学公式/SVG 图/嵌套链接均不被破坏
{
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<div id='root'></div>");
  globalThis.document = dom.window.document;
  globalThis.NodeFilter = dom.window.NodeFilter;
  globalThis.Node = dom.window.Node;
  globalThis.HTMLElement = dom.window.HTMLElement;

  const root = dom.window.document.getElementById("root");
  root.innerHTML = `
<h2>标题</h2>
<p>内存是重要概念。</p>
<table>
  <thead><tr><th>概念</th></tr></thead>
  <tbody><tr><td>内存</td><td>堆</td></tr></tbody>
</table>
<div class="block-language-dataview"><table class="dataview"><thead><tr><th>文件</th></tr></thead><tbody><tr><td>内存笔记</td></tr></tbody></table></div>
<p><a href="x"><strong>内存</strong>链接</a></p>
<span class="math math-inline"><mjx-container><svg><text>内存公式</text></svg></mjx-container></span>
<pre class="mermaid"><svg><text>流程开始</text></svg></pre>
`;
  const terms = [
    { text: "内存", importance: 9 },
    { text: "堆", importance: 5 },
    { text: "流程开始", importance: 8 },
  ];
  const masked = new Set(terms.map((t) => t.text));
  const spans = mod.wrapClozeTerms(root, terms, masked, new Set());
  ok(root.querySelectorAll("table").length === 2, "markdown 表格与 dataview 表格均保留");
  ok(root.querySelectorAll(".block-language-dataview").length === 1, "dataview 容器保留");
  ok(root.querySelectorAll(".math").length === 1, "数学公式容器保留");
  ok(root.querySelectorAll("pre.mermaid").length === 1, "mermaid 图保留");
  ok(root.querySelector("a strong .ac-cloze") === null, "跳过嵌套在链接里的文本");
  ok(root.querySelector("svg .ac-cloze") === null, "跳过 SVG 内文本（不破坏图）");
  ok(root.querySelector("mjx-container .ac-cloze") === null, "跳过数学公式内文本");
  // 表格单元格仍可正常挖空；dataview 渲染结果不挖空（动态内容，避免破坏）
  ok(root.querySelectorAll("td .ac-cloze").length === 2, "markdown 表格单元格可正常挖空");
  ok(root.querySelectorAll(".block-language-dataview .ac-cloze").length === 0, "dataview 渲染结果不挖空");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
