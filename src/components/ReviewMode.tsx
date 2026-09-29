import { Button, Space, Tag, Progress } from "antd";
import { ItemView, TFile } from "obsidian";
import { useEffect, useMemo, useRef } from "react";
import { renderMarkdownWithCloze } from "../view";
import { t } from "../i18n";
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

const GRADE_KEYS = ["grade.again", "grade.hard", "grade.good", "grade.easy"] as const;
const gradeLabel = (g: Grade): string => t(GRADE_KEYS[g]);

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
  // the current card's cloze spans (filled after rendering), used to reveal the answer in place
  const spansRef = useRef<HTMLSpanElement[]>([]);
  const renderIdRef = useRef(0);
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;

  const maskedTerms = useMemo(() => terms.filter((t) => masked.has(t.text)), [terms, masked]);
  const card = maskedTerms[idx] ?? null;
  const total = maskedTerms.length;
  const finished = total > 0 && idx >= total;

  // when switching cards, render that card's cloze wholesale (the rest of the source displays normally)
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
      // the user may have clicked "show answer" during rendering; top up class names with the latest state
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revealedRef read intentionally; re-render only on card switch
  }, [view, file, source, terms, card]);

  // reveal answer: add/remove ac-revealed on the current card's spans in place, without re-rendering the page
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
        <h3>{t("review.doneTitle")}</h3>
        <p>{t("review.doneSummary", { total, mastered })}</p>
        <p className="ac-grade-queue">{t("review.gradeSeq", { seq: gradeQueue.map((g) => gradeLabel(g)).join(" → ") })}</p>
        <p className="ac-grade-queue">{t("review.autoUpdated")}</p>
        <Button type="primary" onClick={onExport}>
          {t("review.exportBtn")}
        </Button>
      </div>
    );
  }

  if (!card) {
    return <div className="ac-empty">{t("review.noCards")}</div>;
  }

  return (
    <div className="ac-review">
      <div className="ac-review-head">
        <Space>
          <Tag color="purple">{t("review.modeTag")}</Tag>
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
            {t("review.showAnswer")}
          </Button>
        ) : (
          <>
            <div className="ac-grade-tip">{t("review.gradeTip")}</div>
            <Space wrap>
              {GRADE_KEYS.map((key, g) => (
                <Button key={g} size="large" danger={g === 0} type={g === 2 ? "primary" : "default"} onClick={() => onGrade(g as Grade)}>
                  {t(key)}
                </Button>
              ))}
            </Space>
            {gradeQueue.length > 0 && (
              <div className="ac-grade-queue">{t("review.thisGrades", { seq: gradeQueue.map((g) => gradeLabel(g)).join(" → ") })}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
