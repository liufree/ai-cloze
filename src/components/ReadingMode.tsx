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
  // term → all its cloze spans (filled after rendering), used to update class names in place
  const spansRef = useRef<Map<string, HTMLSpanElement[]>>(new Map());
  // render sequence number: increments when content changes; stale renders are abandoned via isStale
  const renderIdRef = useRef(0);
  const maskedRef = useRef(masked);
  const revealedRef = useRef(revealed);
  maskedRef.current = masked;
  revealedRef.current = revealed;

  // only re-render wholesale when the source/cloze term list changes; cloze state changes only update class names, avoiding whole-page flicker
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
        // state may have changed again during rendering; top up class names with the latest state
        applyCloakClasses(spans, maskedRef.current, revealedRef.current);
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, file, source, terms]);

  // masked/revealed changes: toggle class names in place without rebuilding the DOM
  useEffect(() => {
    applyCloakClasses([...spansRef.current.values()].flat(), masked, revealed);
  }, [masked, revealed]);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const span = target.closest<HTMLElement>(".ac-cloze.ac-masked");
    if (!span?.dataset.term) return;
    // first toggle the current span in place (no whole-page re-render flicker); then sync React state to keep the toolbar consistent
    span.classList.toggle("ac-revealed");
    onToggleTerm(span.dataset.term);
  };

  return <div className="ac-markdown" ref={ref} onClick={handleClick} />;
}
