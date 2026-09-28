import { Button, Space, Tag, Progress } from "antd";
import { ItemView, TFile } from "obsidian";
import { useEffect, useMemo, useRef } from "react";
import { renderMarkdownWithCloze } from "../view";
import type { ClozeTerm } from "../types";

export type Grade = 0 | 1 | 2 | 3;

interface Props {
  view: ItemView;
  file: TFile;
  source: string;
  terms: ClozeTerm[];
  masked: Set<string>;
  idx: number;
  revealed: boolean;
  gradeQueue: Grade[];
  onReveal: () => void;
  onGrade: (g: Grade) => void;
  onExport: () => void;
}

const GRADE_LABEL: Record<Grade, string> = {
  0: "再次",
  1: "困难",
  2: "良好",
  3: "简单",
};

export function ReviewMode({
  view,
  file,
  source,
  terms,
  masked,
  idx,
  revealed,
  gradeQueue,
  onReveal,
  onGrade,
  onExport,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // 当前卡片的挖空 span（渲染完成后填充），用于原地显示答案
  const spansRef = useRef<HTMLSpanElement[]>([]);
  const renderIdRef = useRef(0);
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;

  const maskedTerms = useMemo(() => terms.filter((t) => masked.has(t.text)), [terms, masked]);
  const card = maskedTerms[idx] ?? null;
  const total = maskedTerms.length;
  const finished = total > 0 && idx >= total;

  // 每张卡切换时整体渲染该卡对应的挖空（原文其余部分照常显示）
  useEffect(() => {
    if (!ref.current || !card) return;
    const id = ++renderIdRef.current;
    let cancelled = false;
    const onlyThis = new Set([card.text]);
    void renderMarkdownWithCloze(
      ref.current,
      source,
      file,
      view,
      terms,
      onlyThis,
      revealedRef.current ? onlyThis : new Set<string>(),
      () => cancelled || renderIdRef.current !== id
    ).then((spans) => {
      if (cancelled) return;
      spansRef.current = spans;
      // 渲染期间用户可能已点「显示答案」，用最新状态补齐类名
      if (revealedRef.current) {
        for (const span of spans) {
          if (span.dataset.term !== card.text) continue;
          span.classList.add("ac-revealed");
        }
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, file, source, terms, card]);

  // 显示答案：原地给当前卡的 span 加/去 ac-revealed，不重渲染整页
  useEffect(() => {
    if (!card) return;
    for (const span of spansRef.current) {
      if (span.dataset.term !== card.text) continue;
      span.classList.toggle("ac-revealed", revealed);
    }
  }, [revealed, card]);

  const progress = total > 0 ? Math.min(100, Math.round((idx / total) * 100)) : 0;

  if (finished) {
    const mastered = gradeQueue.filter((g) => g >= 2).length;
    return (
      <div className="ac-empty">
        <h3>本轮复习完成 🎉</h3>
        <p>共复习 {total} 个知识点，良好/简单 {mastered} 个。</p>
        <p className="ac-grade-queue">评分序列：{gradeQueue.map((g) => GRADE_LABEL[g]).join(" → ")}</p>
        <p className="ac-grade-queue">已自动更新间隔记忆进度，到期后会自动进入复习队列。</p>
        <Button type="primary" onClick={onExport}>
          导出已掌握为闪卡（==词== → 笔记）
        </Button>
      </div>
    );
  }

  if (!card) {
    return <div className="ac-empty">没有可复习的挖空词。请先回到阅读模式进行 AI 挖空。</div>;
  }

  return (
    <div className="ac-review">
      <div className="ac-review-head">
        <Space>
          <Tag color="purple">复习模式</Tag>
          <span className="ac-review-counter">
            {idx + 1} / {total}
          </span>
          <Progress percent={progress} showInfo={false} style={{ width: 160 }} />
        </Space>
      </div>

      <div className="ac-markdown" ref={ref} />

      <div className="ac-review-actions">
        {!revealed ? (
          <Button type="primary" size="large" block onClick={onReveal}>
            显示答案
          </Button>
        ) : (
          <>
            <div className="ac-grade-tip">这个词记住了吗？</div>
            <Space wrap>
              {(Object.keys(GRADE_LABEL) as unknown as Grade[]).map((g) => (
                <Button key={g} size="large" danger={g === 0} type={g === 2 ? "primary" : "default"} onClick={() => onGrade(g)}>
                  {GRADE_LABEL[g]}
                </Button>
              ))}
            </Space>
            {gradeQueue.length > 0 && (
              <div className="ac-grade-queue">本次评分：{gradeQueue.map((g) => GRADE_LABEL[g]).join(" → ")}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
