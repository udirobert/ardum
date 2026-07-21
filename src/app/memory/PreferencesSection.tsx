"use client";

// ADR 0011 §4: preference profile. A quiet, editable section on /memory
// where the practitioner tells Mira how they like to be met. These are
// cross-episode defaults — not per-intention constraints. The ranking
// policy may consume them as default inputs alongside per-episode
// constraints.
//
// No wizard, no progress bar, no "complete your profile" nudge. Each
// field is optional and editable in place. Saved via PATCH
// /api/actor/profile with the `profile` field.

import { useState, useTransition } from "react";

type Preferences = {
  accommodation?: string;
  dietary?: string;
  practiceStyle?: string;
  notes?: string;
};

type Props = {
  initial: Record<string, unknown>;
};

const ACCOMMODATION_OPTIONS = [
  { value: "", label: "No preference" },
  { value: "private", label: "Private room" },
  { value: "shared", label: "Shared room" },
  { value: "dormitory", label: "Dormitory" },
  { value: "camping", label: "Camping / outdoor" },
];

const DIETARY_OPTIONS = [
  { value: "", label: "No restriction" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "gluten-free", label: "Gluten-free" },
  { value: "other", label: "Other (see notes)" },
];

const PRACTICE_OPTIONS = [
  { value: "", label: "No preference" },
  { value: "gentle", label: "Gentle / restorative" },
  { value: "vigorous", label: "Vigorous / heat-building" },
  { value: "meditation", label: "Meditation-focused" },
  { value: "mixed", label: "Mixed" },
];

function toPreferences(raw: Record<string, unknown>): Preferences {
  return {
    accommodation: typeof raw.accommodation === "string" ? raw.accommodation : "",
    dietary: typeof raw.dietary === "string" ? raw.dietary : "",
    practiceStyle: typeof raw.practiceStyle === "string" ? raw.practiceStyle : "",
    notes: typeof raw.notes === "string" ? raw.notes : "",
  };
}

export default function PreferencesSection({ initial }: Props) {
  const [prefs, setPrefs] = useState<Preferences>(() => toPreferences(initial));
  const [saved, setSaved] = useState<Preferences>(() => toPreferences(initial));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty =
    prefs.accommodation !== saved.accommodation ||
    prefs.dietary !== saved.dietary ||
    prefs.practiceStyle !== saved.practiceStyle ||
    prefs.notes !== saved.notes;

  function update(field: keyof Preferences, value: string) {
    setPrefs((prev) => ({ ...prev, [field]: value }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/actor/profile", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ profile: prefs }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Could not save.");
        }
        setSaved({ ...prefs });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save.");
      }
    });
  }

  return (
    <div className="mb-10">
      <p className="tag mb-2">what Mira has learned about you</p>
      <p className="text-sm text-[color:var(--muted)] mb-5 leading-relaxed">
        These are your defaults across intentions. Mira will keep them in mind
        when she considers what fits. Change them anytime.
      </p>

      <div className="space-y-5">
        <label className="block">
          <span className="text-sm font-medium block mb-1.5">Accommodation</span>
          <select
            value={prefs.accommodation ?? ""}
            onChange={(e) => update("accommodation", e.target.value)}
            onBlur={dirty ? save : undefined}
            className="w-full px-4 py-2.5 rounded-sm border bg-transparent text-base"
            style={{ borderColor: "var(--hairline)" }}
          >
            {ACCOMMODATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium block mb-1.5">Dietary</span>
          <select
            value={prefs.dietary ?? ""}
            onChange={(e) => update("dietary", e.target.value)}
            onBlur={dirty ? save : undefined}
            className="w-full px-4 py-2.5 rounded-sm border bg-transparent text-base"
            style={{ borderColor: "var(--hairline)" }}
          >
            {DIETARY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium block mb-1.5">Practice style</span>
          <select
            value={prefs.practiceStyle ?? ""}
            onChange={(e) => update("practiceStyle", e.target.value)}
            onBlur={dirty ? save : undefined}
            className="w-full px-4 py-2.5 rounded-sm border bg-transparent text-base"
            style={{ borderColor: "var(--hairline)" }}
          >
            {PRACTICE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium block mb-1.5">
            Anything else Mira should know
          </span>
          <textarea
            value={prefs.notes ?? ""}
            onChange={(e) => update("notes", e.target.value)}
            onBlur={dirty ? save : undefined}
            rows={3}
            maxLength={500}
            placeholder="Accessibility needs, preferences, things that matter to you…"
            className="w-full px-4 py-2.5 rounded-sm border bg-transparent text-base resize-none"
            style={{ borderColor: "var(--hairline)" }}
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
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
          {pending ? "Saving…" : !dirty ? "Saved" : "Save preferences"}
        </button>
        {error && (
          <span className="text-sm" role="alert" style={{ color: "#c66" }}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
