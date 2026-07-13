"use client";

import type { ReactNode } from "react";
import type { NextDecision } from "@/episodes/model";

const SLIDE_INDEX: Partial<Record<NextDecision["kind"], number>> = {
  "describe-intention": 1,
  "clarify-energy": 1,
  "clarify-budget": 2,
  "clarify-social": 3,
  "review-recommendation": 4,
  "review-hold": 4,
  "invite-participant": 4,
  "await-responses": 4,
  "ready-to-book": 4,
  resume: 4,
};

type Props = {
  decisionKind: NextDecision["kind"];
  prompt: string;
  children: ReactNode;
};

export default function DecisionSlide({ decisionKind, prompt, children }: Props) {
  const page = SLIDE_INDEX[decisionKind] ?? 1;

  return (
    <div className="t-page-slide min-h-[280px]" data-page={String(page)}>
      <div className="t-page" data-page-id="1" aria-hidden={page !== 1}>
        {page === 1 ? (
          <DecisionFrame prompt={prompt}>{children}</DecisionFrame>
        ) : null}
      </div>
      <div className="t-page" data-page-id="2" aria-hidden={page !== 2}>
        {page === 2 ? (
          <DecisionFrame prompt={prompt}>{children}</DecisionFrame>
        ) : null}
      </div>
      <div className="t-page" data-page-id="3" aria-hidden={page !== 3}>
        {page === 3 ? (
          <DecisionFrame prompt={prompt}>{children}</DecisionFrame>
        ) : null}
      </div>
      <div className="t-page" data-page-id="4" aria-hidden={page !== 4}>
        {page === 4 ? (
          <DecisionFrame prompt={prompt}>{children}</DecisionFrame>
        ) : null}
      </div>
    </div>
  );
}

function DecisionFrame({
  prompt,
  children,
}: {
  prompt: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="tag mb-3">the next decision</p>
      <h2 className="font-serif text-3xl tracking-tight mb-6">{prompt}</h2>
      {children}
    </div>
  );
}
