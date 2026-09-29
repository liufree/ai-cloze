import { Button, ConfigProvider, Segmented, Slider, Space, Spin, Tag, Tooltip, App as AntApp, theme as antdTheme } from "antd";
import { TFile } from "obsidian";
import { useCallback, useEffect, useMemo, useState } from "react";
import { generateClozeTerms, hashText } from "../cloze";
import type { ClozeTerm, NoteClozeCache } from "../types";
import type { ClozeView } from "../view";
import type AIClozePlugin from "../main";
import { cardKey, reviewCard, isDue } from "../srs";
import { t } from "../i18n";
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

  // background pre-generation in progress: when opening the view, detect whether background generation is running and enter a waiting state
  useEffect(() => {
    setBgGenerating(!!activeFile && plugin.generatingPaths.has(activeFile.path));
  }, [activeFile?.path, plugin]);

  // after background generation completes: take over the result and render the cache directly, no manual trigger needed
  useEffect(() => {
    const off = plugin.onBackgroundDone((path) => {
      const current = view.getFile();
      if (current?.path !== path) return;
      setBgGenerating(false);
      void loadFile(current);
    });
    return off;
  }, [plugin, loadFile, view]);

  // watch the source for changes: re-read after the file is modified and flag the cache as possibly stale
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
      if (plugin.generatingPaths.has(file.path)) return; // background generation in progress; wait for it to finish to avoid duplicate concurrent runs
      if (!force && plugin.settings.clozeCache[file.path]) return; // already cached, unless forced to re-cloze
      setGenerating(true);
      try {
        const newTerms = await generateClozeTerms(plugin.settings.provider, source);
        if (newTerms.length === 0) {
          api.warning(t("msg.aiEmpty"));
          return;
        }
        setTerms(newTerms);
        await saveCache(newTerms, source, density);
        setStale(false);
        setRevealed(new Set());
        setReviewIdx(0);
        setReviewRevealed(false);
        setGradeQueue([]);
        api.success(t("msg.clozeDone", { count: newTerms.length }));
      } catch (e) {
        api.error(e instanceof Error ? e.message : String(e));
      } finally {
        setGenerating(false);
      }
    },
    [plugin, file, source, density, saveCache, api]
  );

  // on open: use the cache directly if present; otherwise decide whether to call the AI based on the "auto cloze" toggle (forceGenerate is passed by command)
  useEffect(() => {
    if (!file || generating) return;
    if (view.state.forceGenerate) {
      void doGenerate(true);
      // consume it once, so reopening the same view later doesn't force cloze again
      view.state.forceGenerate = false;
    } else if (
      plugin.settings.autoCloze &&
      !plugin.settings.clozeCache[file.path] &&
      !plugin.generatingPaths.has(file.path)
    ) {
      api.info(t("msg.autoCloze"));
      void doGenerate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when the active file changes or a force-generate is requested
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
    // write terms graded good/easy in this review session back to the note's flashcard section as ==term== (compatible with Spaced Repetition)
    const maskedTerms = terms.filter((t) => masked.has(t.text));
    const reviewed = gradeQueue.map((g, i) => ({ g, term: maskedTerms[i]?.text }));
    const mastered = reviewed
      .filter((r): r is { g: Grade; term: string } => r.g >= 2 && !!r.term)
      .map((r) => r.term);
    if (mastered.length === 0) {
      api.info(t("msg.noExport"));
      return;
    }
    const orig = await plugin.app.vault.read(file);
    const lines = mastered.map((t) => `- ==${t}==`);
    const section =
      orig.includes("#flashcards 复习/闪卡")
        ? `${orig.replace(/\s*$/, "")}\n${lines.join("\n")}\n`
        : `${orig.replace(/\s*$/, "")}\n\n## 🎴 挖空闪卡\n\n#flashcards 复习/闪卡\n${lines.join("\n")}\n`;
    await plugin.app.vault.modify(file, section);
    api.success(t("msg.exported", { count: mastered.length }));
  }, [file, terms, masked, gradeQueue, plugin, api]);

  if (!file) {
    return (
      <div className="ac-empty">
        {t("empty.noFile")}
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
                { label: t("mode.read"), value: "read" },
                { label: t("mode.review"), value: "review" },
              ]}
            />
            <Tooltip title={hasCache ? t("tag.cacheHint") : t("tag.noCache")}>
              <Tag color={stale ? "orange" : hasCache ? "green" : bgGenerating ? "processing" : "default"}>
                {stale ? t("tag.stale") : hasCache ? t("tag.lastCloze", { model: plugin.settings.clozeCache[file.path].model }) : bgGenerating ? t("tag.bgGenerating") : t("tag.notClozed")}
              </Tag>
            </Tooltip>
            {mode === "review" && dueCount > 0 && <Tag color="red">{t("tag.dueCount", { count: dueCount })}</Tag>}
          </Space>
          <Space wrap>
            <span className="ac-density-label">{t("toolbar.density")}</span>
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
              {t("toolbar.regenerate")}
            </Button>
            {mode === "read" && terms.length > 0 && (
              <>
                <Button onClick={revealAll}>{t("toolbar.revealAll")}</Button>
                <Button onClick={hideAll}>{t("toolbar.hideAll")}</Button>
              </>
            )}
            <Button onClick={() => void view.openOriginal()}>{t("toolbar.backToDoc")}</Button>
          </Space>
        </div>

        <div className="ac-status">
          <Tag>{plugin.settings.provider.provider} · {plugin.settings.provider.model}</Tag>
          <Tag color={masteredCount > 0 ? "green" : "default"}>{t("status.mastered", { count: masteredCount })}</Tag>
        </div>

        <div className="ac-body">
          {bgGenerating ? (
            <div className="ac-loading">
              <Spin tip={t("loading.bg")} size="large" />
            </div>
          ) : generating && terms.length === 0 ? (
            <div className="ac-loading">
              <Spin tip={t("loading.generate")} size="large" />
            </div>
          ) : terms.length === 0 ? (
            <div className="ac-empty">
              <p>{t("empty.noResult")}</p>
              <Button type="primary" loading={generating} onClick={() => void doGenerate(true)}>
                {t("button.generate")}
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
