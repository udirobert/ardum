"use client";

// CommitmentRailTrace — ToolChips primitive adapted for the commitment
// securing surface.
//
// The securing surface currently shows a single mutable label ("Preparing
// your account…" → "Securing your place…" → "Confirming your place…") and
// BreathSync. The actual work — account preparation, deposit routing,
// booking attestation — is invisible.
//
// This component makes the rail steps visible as they complete, without
// naming the chain, upgrade, or EIP-7702. Each step is Mira-voiced (not
// tool-voiced) and carries an evidence chip that stays inspectable after
// the fact. The collapsible header adapts the ToolChips "4 tool calls"
// pattern to "commitment steps."
//
// Design contract (ADR 0008): "rails stay under disclosure" but "inspectable."
// The detail lines show what was done, not how — "deposit confirmed" not
// "sendUserOperation to 0x75faf114…"

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export type RailStep = {
  id: string;
  label: string; // Mira-voiced: "Preparing your account"
  chip?: string; // Evidence reference: "escrow" / "attested"
  detail?: string; // One-line inspectable: "Deposit confirmed"
  status: "pending" | "active" | "done" | "error";
};

export default function CommitmentRailTrace({
  steps,
  defaultExpanded = true,
}: {
  steps: RailStep[];
  defaultExpanded?: boolean;
}) {
  const [open, setOpen] = useState(defaultExpanded);
  const completedCount = steps.filter((s) => s.status === "done").length;

  return (
    <div className="w-full max-w-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="-mx-1.5 flex w-fit items-center gap-1.5 rounded-sm px-1.5 py-1 text-[12.5px] text-[color:var(--muted)] transition-colors duration-100 hover:text-foreground"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-200"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        <span className="tabular-nums">
          {completedCount} of {steps.length} steps
        </span>
      </button>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-300"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          opacity: open ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <div className="mt-1.5 flex flex-col gap-1">
            <AnimatePresence>
              {steps.map((step) => {
                const isActive = step.status === "active";
                const isDone = step.status === "done";
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                    className="flex min-h-7 w-full items-center gap-2 rounded-sm px-1.5 text-left"
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center text-[color:var(--muted)]">
                      {isDone ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : isActive ? (
                        <span
                          className="size-3 shrink-0 rounded-full border-[1.5px] border-[color:var(--hairline)] border-t-[color:var(--accent)]"
                          style={{ animation: "spin 700ms linear infinite" }}
                        />
                      ) : (
                        <span className="size-3 shrink-0 rounded-full border-[1.5px] border-[color:var(--hairline)]" />
                      )}
                    </span>
                    <span className="shrink-0 text-[12.5px] font-medium text-[color:var(--foreground)]">
                      {step.label}
                    </span>
                    {step.chip && (
                      <span
                        className={`inline-flex h-5 min-w-0 flex-1 items-center truncate rounded-sm border border-[color:var(--hairline)] px-1.5 text-[11.5px] text-[color:var(--muted)] ${isActive ? "" : "opacity-60"}`}
                      >
                        {step.chip}
                      </span>
                    )}
                    {isDone && step.detail && (
                      <span className="shrink-0 text-[11px] text-[color:var(--accent-ink)] opacity-80">
                        {step.detail}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
