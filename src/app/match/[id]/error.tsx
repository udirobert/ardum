"use client";

// Error boundary for the match detail page. Catches client-side
// hydration or runtime errors so the user sees a useful message
// instead of a blank "This page couldn't load" screen.

import { useEffect } from "react";

export default function MatchDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to the server so we can see what's crashing hydration.
    console.error("match/[id] error boundary:", error);
  }, [error]);

  return (
    <section className="mx-auto max-w-2xl px-6 sm:px-10 pt-20">
      <p className="tag mb-3">error</p>
      <h1 className="font-serif text-4xl tracking-tight mb-4">
        This page couldn&rsquo;t load.
      </h1>
      <p className="text-[color:var(--accent-ink)] mb-3 max-w-prose leading-relaxed">
        {error.message || "An unexpected error occurred."}
      </p>
      {error.digest && (
        <p className="tag mb-8">digest: {error.digest}</p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="px-5 py-2.5 rounded-sm bg-foreground text-background hover:bg-[color:var(--accent-ink)] transition-colors"
        >
          Reload →
        </button>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-5 py-2.5 rounded-sm border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] transition-colors text-[color:var(--muted)] hover:text-foreground"
        >
          Back
        </button>
      </div>
    </section>
  );
}
