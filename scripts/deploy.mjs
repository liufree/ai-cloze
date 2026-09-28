import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(root, "../../../.obsidian/plugins/ai-cloze");

const files = [
  { src: "dist/main.js", dst: "main.js" },
  { src: "manifest.json", dst: "manifest.json" },
  { src: "versions.json", dst: "versions.json" },
  { src: "src/styles.css", dst: "styles.css" },
];
for (const { src: s, dst: d } of files) {
  const src = join(root, s);
  const dst = join(target, d);
  if (!existsSync(src)) {
    console.error(`missing ${src}`);
    process.exit(1);
  }
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
  console.log(`deployed ${dst}`);
}
console.log("ai-cloze deployed to .obsidian/plugins/ai-cloze/");
