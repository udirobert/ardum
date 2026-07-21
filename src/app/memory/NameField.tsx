"use client";

// ADR 0011 §1: voluntary naming. A quiet editable field on /memory that
// lets the practitioner tell Mira their name. Never required, never gated
// on auth. Saved via PATCH /api/actor/profile; the server trims and caps.

import { useState, useTransition } from "react";

type Props = {
  initialName: string | null;
};

export default function NameField({ initialName }: Props) {
  const [name, setName] = useState(initialName ?? "");
  const [saved, setSaved] = useState<string | null>(initialName);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    const trimmed = name.trim();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/actor/profile", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ preferredName: trimmed }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Could not save.");
        }
        const data = (await res.json()) as {
          profile: { preferredName: string | null };
        };
        setSaved(data.profile.preferredName);
        setName(data.profile.preferredName ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save.");
      }
    });
  }

  const dirty = name.trim() !== (saved ?? "");

  return (
    <div className="mb-10">
      <p className="tag mb-2">what Mira calls you</p>
      <p className="text-sm text-[color:var(--muted)] mb-3 leading-relaxed">
        Optional. Mira will use this in her greeting. You can clear it anytime.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={dirty ? save : undefined}
          placeholder="your first name"
          maxLength={80}
          className="flex-1 min-w-[12rem] px-4 py-2.5 rounded-sm border bg-transparent text-lg"
          style={{ borderColor: "var(--hairline)" }}
          data-testid="preferred-name-input"
        />
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending}
          className="px-5 py-2.5 rounded-sm disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: dirty ? "var(--foreground)" : "transparent",
            color: dirty ? "var(--background)" : "var(--muted)",
            border: dirty ? "none" : "1px solid var(--hairline)",
          }}
        >
          {pending ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm" role="alert" style={{ color: "#c66" }}>
          {error}
        </p>
      )}
      {saved && !dirty && (
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Mira will greet you as {saved}.
        </p>
      )}
    </div>
  );
}
