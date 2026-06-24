"use client";

import { useState } from "react";

// "Clear my history" link for the match page footer. Quiet by default;
// a single click confirms the action so the user can never wipe their
// fingerprint by accident.
export default function ClearHistoryLink({
  onClear,
}: {
  onClear: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p className="tag">cleared &mdash; the agent starts fresh next visit.</p>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="tag hover:text-foreground transition-colors"
      >
        clear my history
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="tag">clear local memory?</span>
      <button
        type="button"
        onClick={() => {
          onClear();
          setDone(true);
        }}
        className="tag underline hover:text-foreground transition-colors"
      >
        yes
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="tag hover:text-foreground transition-colors"
      >
        cancel
      </button>
    </span>
  );
}
