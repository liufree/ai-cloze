import { TFile, ItemView } from "obsidian";
import { useEffect, useRef } from "react";
import { renderMarkdownWithCloze } from "../view";
import { applyCloakClasses } from "../dom";
import type { ClozeTerm } from "../types";

interface Props {
  view: ItemView;
  file: TFile;
  source: string;
  terms: ClozeTerm[];
  masked: Set<string>;
  revealed: Set<string>;
  onToggleTerm: (term: string) => void;
}

export function ReadingMode({ view, file, source, terms, masked, revealed, onToggleTerm }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // term → 对应所有挖空 span（渲染完成后填充），用于原地更新类名
  const spansRef = useRef<Map<string, HTMLSpanElement[]>>(new Map());
  // 渲染序号：内容变化时自增，旧渲染通过 isStale 自动放弃
  const renderIdRef = useRef(0);
  const maskedRef = useRef(masked);
  const revealedRef = useRef(revealed);
  maskedRef.current = masked;
  revealedRef.current = revealed;

  // 仅原文/挖空词表变化才整体重渲染；挖空状态变化只更新类名，避免整页闪烁
  useEffect(() => {
    const id = ++renderIdRef.current;
    const map = new Map<string, HTMLSpanElement[]>();
    let cancelled = false;
    if (ref.current) {
      void renderMarkdownWithCloze(
        ref.current,
        source,
        file,
        view,
        terms,
        maskedRef.current,
        revealedRef.current,
        () => cancelled || renderIdRef.current !== id
      ).then((spans) => {
        if (cancelled) return;
        for (const span of spans) {
          const term = span.dataset.term;
          if (!term) continue;
          const arr = map.get(term);
          if (arr) arr.push(span);
          else map.set(term, [span]);
        }
        spansRef.current = map;
        // 渲染期间状态可能又变了，用最新状态补齐类名
        applyCloakClasses(spans, maskedRef.current, revealedRef.current);
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, file, source, terms]);

  // masked/revealed 变化：原地切换类名，不重建 DOM
  useEffect(() => {
    applyCloakClasses([...spansRef.current.values()].flat(), masked, revealed);
  }, [masked, revealed]);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const span = target.closest<HTMLElement>(".ac-cloze.ac-masked");
    if (!span?.dataset.term) return;
    // 先原地切换当前 span，无整页重渲染的闪烁；再同步 React 状态保持工具栏一致
    span.classList.toggle("ac-revealed");
    onToggleTerm(span.dataset.term);
  };

  return <div className="ac-markdown" ref={ref} onClick={handleClick} />;
}
