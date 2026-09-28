import { Button, ConfigProvider, Segmented, Slider, Space, Spin, Tag, Tooltip, App as AntApp, theme as antdTheme } from "antd";
import { TFile } from "obsidian";
import { useCallback, useEffect, useMemo, useState } from "react";
import { generateClozeTerms, hashText } from "../cloze";
import type { ClozeTerm, NoteClozeCache } from "../types";
import type { ClozeView } from "../view";
import type AIClozePlugin from "../main";
import { cardKey, reviewCard, isDue } from "../srs";
import { ReadingMode } from "./ReadingMode";
import { ReviewMode, type Grade } from "./ReviewMode";

type Mode = "read" | "review";

interface Props {
  plugin: AIClozePlugin;
  view: ClozeView;
}

export function App({ plugin, view }: Props) {
  const isDark = document.body.classList.contains("theme-dark");
  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: { colorPrimary: "#7c5cff" },
      }}
    >
      <AntApp component={false}>
        <AppInner plugin={plugin} view={view} />
      </AntApp>
    </ConfigProvider>
  );
}

function AppInner({ plugin, view }: Props) {
  const { message: api } = AntApp.useApp();
  const [source, setSource] = useState("");
  const [file, setFile] = useState<TFile | null>(null);
  const [terms, setTerms] = useState<ClozeTerm[]>([]);
  const [density, setDensity] = useState(plugin.settings.defaultDensity);
  const [mode, setMode] = useState<Mode>("read");
  const [generating, setGenerating] = useState(false);
  const [bgGenerating, setBgGenerating] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [reviewIdx, setReviewIdx] = useState(0);
  const [reviewRevealed, setReviewRevealed] = useState(false);
  const [gradeQueue, setGradeQueue] = useState<Grade[]>([]);
  const [stale, setStale] = useState(false);

  const activeFile = view.getFile();

  const loadFile = useCallback(
    async (f: TFile | null) => {
      if (!f) {
        setFile(null);
        setSource("");
        setTerms([]);
        return;
      }
      const text = await plugin.app.vault.cachedRead(f);
      setFile(f);
      setSource(text);
      const cache = plugin.settings.clozeCache[f.path];
      if (cache) {
        setTerms(cache.terms);
        setDensity(cache.density ?? plugin.settings.defaultDensity);
        setStale(hashText(text) !== cache.sourceHash);
      } else {
        setTerms([]);
        setStale(false);
      }
      setMode("read");
      setRevealed(new Set());
      setReviewIdx(0);
      setReviewRevealed(false);
      setGradeQueue([]);
    },
    [plugin]
  );

  useEffect(() => {
    void loadFile(activeFile);
  }, [activeFile?.path, loadFile]);

  // 后台预生成进行中：打开视图时检测是否正在后台生成，进入等待态
  useEffect(() => {
    setBgGenerating(!!activeFile && plugin.generatingPaths.has(activeFile.path));
  }, [activeFile?.path, plugin]);

  // 后台生成完成后：接管结果，直接渲染缓存，无需手动触发
  useEffect(() => {
    const off = plugin.onBackgroundDone((path) => {
      const current = view.getFile();
      if (current?.path !== path) return;
      setBgGenerating(false);
      void loadFile(current);
    });
    return off;
  }, [plugin, loadFile, view]);

  // 监听原文变化：文件修改后重读，并标记缓存可能过期
  useEffect(() => {
    const handler = (changed: unknown) => {
      if (!(changed instanceof TFile) || changed.path !== activeFile?.path) return;
      void (async () => {
        const f = plugin.app.vault.getAbstractFileByPath(changed.path);
        if (!(f instanceof TFile)) return;
        const text = await plugin.app.vault.cachedRead(f);
        setSource(text);
        const cache = plugin.settings.clozeCache[changed.path];
        if (cache) setStale(hashText(text) !== cache.sourceHash);
      })();
    };
    plugin.app.vault.on("modify", handler);
    return () => {
      plugin.app.vault.off("modify", handler);
    };
  }, [activeFile?.path, plugin]);

  const masked = useMemo(
    () => new Set(terms.filter((t, i) => i < Math.max(1, Math.round((terms.length * density) / 100))).map((t) => t.text)),
    [terms, density]
  );

  const saveCache = useCallback(
    async (newTerms: ClozeTerm[], src: string, d: number) => {
      if (!file) return;
      const cache: NoteClozeCache = {
        source: src,
        sourceHash: hashText(src),
        terms: newTerms,
        density: d,
        createdAt: Date.now(),
        model: plugin.settings.provider.model,
      };
      plugin.settings.clozeCache[file.path] = cache;
      await plugin.saveData(plugin.settings);
    },
    [plugin, file]
  );

  const doGenerate = useCallback(
    async (force: boolean) => {
      if (!file) return;
      if (plugin.generatingPaths.has(file.path)) return; // 后台正在生成，等待其完成，避免重复并发
      if (!force && plugin.settings.clozeCache[file.path]) return; // 已缓存，除非强制重新挖空
      setGenerating(true);
      try {
        const newTerms = await generateClozeTerms(plugin.settings.provider, source);
        if (newTerms.length === 0) {
          api.warning("AI 未返回有效挖空词，请检查 Provider 配置或重试");
          return;
        }
        setTerms(newTerms);
        await saveCache(newTerms, source, density);
        setStale(false);
        setRevealed(new Set());
        setReviewIdx(0);
        setReviewRevealed(false);
        setGradeQueue([]);
        api.success(`AI 挖空完成，共 ${newTerms.length} 个知识点`);
      } catch (e) {
        api.error(e instanceof Error ? e.message : String(e));
      } finally {
        setGenerating(false);
      }
    },
    [plugin, file, source, density, saveCache, api]
  );

  // 打开时：若有缓存直接使用；没有缓存时按「自动挖空」开关决定是否调用 AI（forceGenerate 由命令传入）
  useEffect(() => {
    if (!file || generating) return;
    if (view.state.forceGenerate) {
      void doGenerate(true);
      // 一次性消费，避免下次重新打开同一视图时再次强制挖空
      view.state.forceGenerate = false;
    } else if (
      plugin.settings.autoCloze &&
      !plugin.settings.clozeCache[file.path] &&
      !plugin.generatingPaths.has(file.path)
    ) {
      api.info("已开启自动挖空，正在调用 AI 生成（会消耗较多 token）…");
      void doGenerate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.path, view.state.forceGenerate]);

  const toggleTerm = useCallback(
    (term: string) => {
      setRevealed((prev) => {
        const next = new Set(prev);
        if (next.has(term)) next.delete(term);
        else next.add(term);
        return next;
      });
    },
    []
  );

  const revealAll = useCallback(() => setRevealed(new Set(terms.map((t) => t.text))), [terms]);
  const hideAll = useCallback(() => setRevealed(new Set()), []);

  const onDensityChange = useCallback(
    (v: number) => {
      setDensity(v);
      if (file) {
        const cache = plugin.settings.clozeCache[file.path];
        if (cache) {
          cache.density = v;
          void plugin.saveData(plugin.settings);
        }
      }
      setRevealed(new Set());
    },
    [file, plugin]
  );

  const dueCount = useMemo(() => {
    if (!file) return 0;
    return Object.values(plugin.settings.review).filter(
      (c) => c.path === file.path && isDue(c)
    ).length;
  }, [file, plugin.settings.review]);

  const onGrade = useCallback(
    async (g: Grade) => {
      if (!file || !terms.length) return;
      const maskedTerms = terms.filter((t) => masked.has(t.text));
      const term = maskedTerms[reviewIdx];
      if (!term) return;
      const key = cardKey(file.path, term.text);
      const prev = plugin.settings.review[key];
      const base = prev ?? {
        path: file.path,
        term: term.text,
        lastGrade: g,
        interval: 0,
        ease: 2.5,
        reps: 0,
        lapses: 0,
        due: Date.now(),
        mastered: false,
      };
      plugin.settings.review[key] = reviewCard(base, g);
      await plugin.saveData(plugin.settings);
      setGradeQueue((q) => [...q, g]);
      setReviewRevealed(false);
      setReviewIdx((i) => i + 1);
    },
    [file, terms, masked, reviewIdx, plugin]
  );

  const exportFlashcards = useCallback(async () => {
    if (!file) return;
    // 把本次复习中评为良好/简单的词，以 ==term== 形式写回笔记闪卡区（兼容 Spaced Repetition）
    const maskedTerms = terms.filter((t) => masked.has(t.text));
    const reviewed = gradeQueue.map((g, i) => ({ g, term: maskedTerms[i]?.text }));
    const mastered = reviewed.filter((r) => r.g >= 2 && r.term).map((r) => r.term as string);
    if (mastered.length === 0) {
      api.info("本次没有评分良好/简单的词可导出");
      return;
    }
    const orig = await plugin.app.vault.read(file);
    const lines = mastered.map((t) => `- ==${t}==`);
    const section =
      orig.includes("#flashcards 复习/闪卡")
        ? `${orig.replace(/\s*$/, "")}\n${lines.join("\n")}\n`
        : `${orig.replace(/\s*$/, "")}\n\n## 🎴 挖空闪卡\n\n#flashcards 复习/闪卡\n${lines.join("\n")}\n`;
    await plugin.app.vault.modify(file, section);
    api.success(`已将 ${mastered.length} 个词写入笔记闪卡区`);
  }, [file, terms, masked, gradeQueue, plugin, api]);

  if (!file) {
    return (
      <div className="ac-empty">
        请先打开一篇 Markdown 笔记，再用命令面板运行「打开当前笔记的 AI 挖空阅读视图」。
      </div>
    );
  }

  const hasCache = !!plugin.settings.clozeCache[file.path];
  const maskedCount = masked.size;
  const masteredCount = terms.filter((t) => plugin.settings.review[cardKey(file.path, t.text)]?.mastered).length;

  return (
    <>
        <div className="ac-toolbar">
          <Space wrap>
            <Segmented<Mode>
              value={mode}
              onChange={(v) => {
                setMode(v);
                setReviewIdx(0);
                setReviewRevealed(false);
                setGradeQueue([]);
              }}
              options={[
                { label: "阅读挖空", value: "read" },
                { label: "复习记忆", value: "review" },
              ]}
            />
            <Tooltip title={hasCache ? "读取上次 AI 生成结果；点击此按钮才会重新调用 AI" : "尚无缓存"}>
              <Tag color={stale ? "orange" : hasCache ? "green" : bgGenerating ? "processing" : "default"}>
                {stale ? "原文已修改" : hasCache ? `上次挖空 · ${plugin.settings.clozeCache[file.path].model}` : bgGenerating ? "后台生成中…" : "未挖空"}
              </Tag>
            </Tooltip>
            {mode === "review" && dueCount > 0 && <Tag color="red">{dueCount} 张到期</Tag>}
          </Space>
          <Space wrap>
            <span className="ac-density-label">挖空密度</span>
            <Slider
              style={{ width: 140 }}
              min={0}
              max={100}
              step={5}
              value={density}
              onChange={onDensityChange}
              disabled={mode === "review" || terms.length === 0}
            />
            <span className="ac-density-val">{maskedCount}/{terms.length}</span>
            <Button
              type="primary"
              loading={generating || bgGenerating}
              disabled={mode === "review" || bgGenerating}
              onClick={() => void doGenerate(true)}
            >
              重新 AI 挖空
            </Button>
            {mode === "read" && terms.length > 0 && (
              <>
                <Button onClick={revealAll}>显示全部</Button>
                <Button onClick={hideAll}>隐藏全部</Button>
              </>
            )}
            <Button onClick={() => void view.openOriginal()}>回到原文档</Button>
          </Space>
        </div>

        <div className="ac-status">
          <Tag>{plugin.settings.provider.provider} · {plugin.settings.provider.model}</Tag>
          <Tag color={masteredCount > 0 ? "green" : "default"}>已掌握 {masteredCount}</Tag>
        </div>

        <div className="ac-body">
          {bgGenerating ? (
            <div className="ac-loading">
              <Spin tip="正在后台生成挖空词…（完成后自动显示）" size="large" />
            </div>
          ) : generating && terms.length === 0 ? (
            <div className="ac-loading">
              <Spin tip="AI 正在分析并生成挖空词…" size="large" />
            </div>
          ) : terms.length === 0 ? (
            <div className="ac-empty">
              <p>这篇笔记还没有挖空结果。</p>
              <Button type="primary" loading={generating} onClick={() => void doGenerate(true)}>
                AI 智能挖空
              </Button>
            </div>
          ) : mode === "read" ? (
            <ReadingMode
              view={view}
              file={file}
              source={source}
              terms={terms}
              masked={masked}
              revealed={revealed}
              onToggleTerm={toggleTerm}
            />
          ) : (
            <ReviewMode
              view={view}
              file={file}
              source={source}
              terms={terms}
              masked={masked}
              idx={reviewIdx}
              revealed={reviewRevealed}
              gradeQueue={gradeQueue}
              onReveal={() => setReviewRevealed(true)}
              onGrade={(g) => void onGrade(g)}
              onExport={() => void exportFlashcards()}
            />
          )}
        </div>
    </>
  );
}
