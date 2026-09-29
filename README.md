# ai-cloze · AI Cloze Reading (Obsidian Plugin)

AI-powered cloze reading view + spaced-repetition review mode. Stack: Obsidian Plugin API + React 18 + Ant Design 5 + esbuild + TypeScript.

[中文](./README.zh.md)

## Features

1. **Custom markdown reading view**: The "Open AI cloze reading view for current note" command renders the current note in a separate tab, where the AI automatically identifies key knowledge points and blanks them out. Click a blank to reveal/hide the answer **in place** (only a CSS class toggle — no full-page rebuild, no flicker). Tables, dataview, math formulas, code, mermaid, and other elements are all preserved intact.
2. **Configurable provider & model**: The settings panel supports OpenAI-compatible / Anthropic / Ollama (local), with Base URL, API Key, model, temperature, and max tokens; a "Test AI connection" button fires a minimal request to verify connectivity in one click.
3. **Adjustable cloze density**: A 0–100% slider adjusts the blank ratio in real time (top-N% ranked by AI importance).
4. **Memory & auto-cloze switches**: Each open reads the per-note cache (`data.json`) directly for the last result; the AI is only re-invoked when you click "Re-cloze with AI"; a yellow hint appears when "original note modified". Enable "auto cloze" in settings to invoke the AI automatically when opening an uncached note (long notes consume a lot of tokens; a hint is shown when this triggers).
5. **Review memory mode**: Flip through cards term by term, click "reveal answer", and rate Again / Hard / Good / Easy (SM-2-style spaced repetition; ease/interval/lapses/reps/due stored in `data.json`). On completion, Good/Easy terms can be written back to the note as under a "🎴 cloze flashcards" section (`#flashcards review/flashcard`, compatible with the Spaced Repetition plugin).
6. **Bidirectional document navigation**: When any markdown note is open, an "AI cloze" button in the view header opens its cloze reading view in one click; the "Back to note" button in the cloze view toolbar jumps back to the original note (activates the existing tab if already open).

## Demo

A demo note is included at [`demo/demo-note.md`](demo/demo-note.md). Open it in Obsidian and run "Open AI cloze reading view for current note" to try AI cloze generation, density adjustment, review cards, and flashcard export.


## Development

```bash
npm install
npm run dev        # watch build
npm run build      # typecheck + production build + deploy to .obsidian/plugins/ai-cloze
npm run smoke      # pure logic + jsdom DOM + React component smoke tests
```

Build output auto-deploys to `.obsidian/plugins/ai-cloze/`; restart Obsidian or reload the plugin in settings to take effect.

## Files

| File                             | Description                                       |
| -------------------------------- | ------------------------------------------------- |
| `src/main.tsx`                   | Plugin entry: registers view, commands, settings tab |
| `src/view.tsx`                   | Custom ItemView (React mount)                     |
| `src/components/App.tsx`         | Main UI: toolbar + reading/review switch + cache & generation logic |
| `src/components/ReadingMode.tsx` | Reading cloze rendering                           |
| `src/components/ReviewMode.tsx`  | Review mode                                       |
| `src/ai.ts`                      | AI provider client (OpenAI-compatible / Anthropic / Ollama) |
| `src/cloze.ts`                   | AI prompt, JSON parsing, density selection        |
| `src/dom.ts`                     | Markdown DOM cloze wrapping                       |
| `src/srs.ts`                     | SM-2 spaced repetition                            |
| `src/settings.ts`                | Settings tab                                      |

## License

MIT