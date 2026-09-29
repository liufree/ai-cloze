# ai-cloze · AI 挖空阅读（Obsidian 插件）

AI 智能挖空阅读视图 + 间隔复习记忆模式。技术栈：Obsidian Plugin API + React 18 + Ant Design 5 + esbuild + TypeScript。

[English](./README.md)

## 功能

1. **自定义 markdown 阅读视图**：命令面板「打开当前笔记的 AI 挖空阅读视图」，在独立 Tab 中渲染当前笔记，AI 自动识别关键知识点并挖空。点击挖空词**原地**显示/隐藏答案（只切类名、不重建整页，无闪烁），表格、dataview、数学公式、代码、mermaid 等元素均完整保留显示。
2. **可配置 Provider 与模型**：设置页支持 OpenAI 兼容 / Anthropic / Ollama（本地），可配置 Base URL、API Key、模型、温度、最大 token；并提供「测试 AI 连通性」按钮，下发极小请求一键验证连接。
3. **可调挖空密度**：0-100% 滑杆实时调整挖空比例（按 AI 重要性排序取前 N%）。
4. **记忆力与自动挖空开关**：每次打开按笔记缓存（`data.json`）直接读取上次结果，只有点「重新 AI 挖空」才重新调用 AI；「原文已修改」会黄色提示。可在设置中开启「自动挖空」——打开无缓存的笔记时自动调用 AI 生成（长文会消耗大量 token，触发时会给出提示）。
5. **复习记忆模式**：逐词翻卡复习，点击「显示答案」，按 再次/困难/良好/简单 评分（SM-2 风格间隔记忆，ease/interval/lapses/reps/due 存 `data.json`）；完成后可把良好/简单的词以 写回笔记「🎴 挖空闪卡」区（`#flashcards 复习/闪卡`，兼容 Spaced Repetition 插件）。
6. **与文档双向跳转**：打开任意 markdown 笔记时，视图头部有「AI 挖空」按钮一键打开该笔记的挖空阅读视图；挖空视图工具栏的「回到原文档」按钮跳回原笔记（已打开则直接激活原 Tab）。

## 演示

仓库内置演示笔记 [`demo/demo-note.md`](demo/demo-note.md)：在 Obsidian 中打开它，执行「打开当前笔记的 AI 挖空阅读视图」即可体验 AI 挖空、密度调节、复习卡片与闪卡导出。


## 开发

```bash
npm install
npm run dev        # watch 构建
npm run build      # 类型检查 + 生产构建 + 部署到 .obsidian/plugins/ai-cloze
npm run smoke      # 纯逻辑 + jsdom DOM + React 组件级冒烟测试
```

构建产物自动部署到 `.obsidian/plugins/ai-cloze/`，重启 Obsidian 或在设置中重新加载插件即可生效。

## 文件

| 文件                               | 说明                                              |
| -------------------------------- | ----------------------------------------------- |
| `src/main.tsx`                   | 插件入口：注册视图、命令、设置页                                |
| `src/view.tsx`                   | 自定义 ItemView（React 挂载）                          |
| `src/components/App.tsx`         | 主界面：工具栏 + 阅读/复习切换 + 缓存与生成逻辑                     |
| `src/components/ReadingMode.tsx` | 阅读挖空渲染                                          |
| `src/components/ReviewMode.tsx`  | 复习模式                                            |
| `src/ai.ts`                      | AI Provider 客户端（OpenAI 兼容 / Anthropic / Ollama） |
| `src/cloze.ts`                   | AI 提示词、JSON 解析、密度选择                             |
| `src/dom.ts`                     | markdown DOM 挖空包装                               |
| `src/srs.ts`                     | SM-2 间隔记忆                                       |
| `src/settings.ts`                | 设置页                                             |

## 许可

MIT