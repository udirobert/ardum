"use client";

// MiraCheckIn — post-booking scheduled follow-ups, with persistence.
//
// After booking, Mira sends timed check-in messages. The user responds,
// and Mira adapts the preparation plan. This component now:
//
//   1. Hydrates any prior responses from localStorage (per-retreat key),
//      so closing the browser and coming back resumes from where the
//      user stopped instead of restarting.
//   2. POSTs each new response to /api/prep-checkin, which writes it
//      to Cognee via cognee.remember() — fueling cross-session recall.
//   3. Surfaces a "you've already told me" recap for returning users.
//
// The localStorage shape never includes user-identifying free text
// beyond Mira's answer options. Each Option is in on a lookup the
// server already knows; the persistence is for UX state, not data
// mining.
//
// In demo mode (no userId, no env), the POST is a graceful no-op and
// localStorage is the source of truth.

import { useEffect, useMemo, useState } from "react";
import MiraOrb from "@/components/MiraOrb";
import { getOrCreateUserId } from "@/lib/fingerprint";

type MiraCheckInProps = {
  retreatTitle: string;
  retreatRootHash?: string;
  signals: { energy?: string; budget?: string; social?: string };
};

type CheckIn = {
  day: number;
  label: string;
  miraSays: string;
  options: { value: string; label: string; adaptsTo: string }[];
};

type Response = {
  day: number;
  answer: string;
  adaptedPlan: string;
  /** ISO timestamp of when the response was given. */
  answeredAt: string;
};

type StoredCheckIns = {
  retreatRootHash: string;
  retreatTitle: string;
  responses: Response[];
};

// localStorage key per retreat — keeps state scoped to the booking.
function storageKey(retreatRootHash: string): string {
  return `ardum:prep-checkin:${retreatRootHash}`;
}

function readStored(key: string): StoredCheckIns | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCheckIns;
    if (!parsed.responses || !Array.isArray(parsed.responses)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: StoredCheckIns): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* swallow — localStorage may be full or unavailable */
  }
}

function buildCheckIns(retreatTitle: string, signals: { energy?: string }): CheckIn[] {
  const energy = signals.energy ?? "settled";

  return [
    {
      day: 1,
      label: "Day 1 — The day after booking",
      miraSays: `You booked ${retreatTitle}. How are you feeling about it?`,
      options: [
        { value: "excited", label: "Excited", adaptsTo: "I'll lean into anticipation — your prep will include reading about the practice style and setting intentions." },
        { value: "nervous", label: "A little nervous", adaptsTo: "That's normal. I'll slow the prep down — more rest, less reading. You don't need to prepare for rest." },
        { value: "unsure", label: "Not sure yet", adaptsTo: "Fair. Let's keep it light for now. I'll check in again in two days — no pressure to feel anything in particular." },
      ],
    },
    {
      day: 3,
      label: "Day 3 — Mid-week check-in",
      miraSays: energy === "low"
        ? "I noticed your energy was low when we matched. Have you been able to rest this week?"
        : "How has your energy been this week? Still the same as when we matched?",
      options: [
        { value: "better", label: "Actually better", adaptsTo: "Good. I'll add a gentle active practice to your prep — your body is ready for movement again." },
        { value: "same", label: "About the same", adaptsTo: "Okay. The original plan still fits. Keep the pace we set." },
        { value: "worse", label: "More depleted", adaptsTo: "I hear you. I'm adjusting the plan — more restorative poses, less stimulation. The retreat will meet you where you are." },
      ],
    },
    {
      day: 5,
      label: "Day 5 — Pre-retreat",
      miraSays: "Tomorrow you leave. Is there anything you want to let go of before you go?",
      options: [
        { value: "yes-work", label: "Work stress", adaptsTo: "Write down three things you're leaving behind. Put the list in your bag. When you arrive, read it once — then leave it there." },
        { value: "yes-relationship", label: "A relationship", adaptsTo: "The retreat isn't about fixing that. It's about finding yourself underneath it. I'll hold that space for you." },
        { value: "no", label: "I feel ready", adaptsTo: "Then go. I'll be here when you get back." },
      ],
    },
  ];
}

export default function MiraCheckIn({
  retreatTitle,
  retreatRootHash,
  signals,
}: MiraCheckInProps) {
  const checkIns = useMemo(
    () => buildCheckIns(retreatTitle, signals),
    // buildCheckIns only reads signals.energy; depending on the whole
    // object would invalidate every parent render that re-creates the
    // signals object literal.
    [retreatTitle, signals.energy],
  );

  // `responses` initial state is read synchronously from localStorage
  // on the very first client render. On SSR (no `window`) we return
  // []; the next client render fills it in. This avoids a two-render
  // "Day 1 → recap" flicker for returning users because there is no
  // useEffect + setState round-trip — by the time the panel paints,
  // the data is already in state.
  const [responses, setResponses] = useState<Response[]>(() => {
    if (typeof window === "undefined") return [];
    if (!retreatRootHash) return [];
    return readStored(storageKey(retreatRootHash))?.responses ?? [];
  });

  // Persist on every change. localStorage.setItem with identical
  // content is cheap enough that we don't gate the first write even
  // though it round-trips the value we just read.
  useEffect(() => {
    if (!retreatRootHash) return;
    if (responses.length === 0) return;
    const record: StoredCheckIns = {
      retreatRootHash,
      retreatTitle,
      responses,
    };
    writeStored(storageKey(retreatRootHash), record);
  }, [responses, retreatRootHash, retreatTitle]);

  const answeredDays = useMemo(
    () => new Set(responses.map((r) => r.day)),
    [responses],
  );
  const currentDay = useMemo(() => {
    for (const ci of checkIns) {
      if (!answeredDays.has(ci.day)) return ci.day;
    }
    return null; // all answered
  }, [checkIns, answeredDays]);

  const isComplete = responses.length === checkIns.length;
  const currentCheckIn =
    currentDay !== null
      ? checkIns.find((ci) => ci.day === currentDay) ?? null
      : null;

  async function persistToCognee(response: Response) {
    if (!retreatRootHash) return;
    try {
      const userId = getOrCreateUserId();
      if (!userId) return;
      await fetch("/api/prep-checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId,
          retreatRootHash,
          retreatTitle,
          day: response.day,
          answer: response.answer,
          adaptedPlan: response.adaptedPlan,
        }),
      });
    } catch {
      /* no-op; localStorage is the source of truth */
    }
  }

  function respond(answer: string, adaptsTo: string) {
    if (!currentCheckIn) return;
    const response: Response = {
      day: currentCheckIn.day,
      answer,
      adaptedPlan: adaptsTo,
      answeredAt: new Date().toISOString(),
    };
    const next = [...responses, response];
    setResponses(next);
    void persistToCognee(response);
  }

  return (
    <div className="mt-8 border border-[color:var(--accent-soft)] rounded-sm bg-[color:var(--surface)] p-6 surface-card">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <MiraOrb size={40} state="calm" />
        <div>
          <p className="font-serif text-lg tracking-tight">Mira checks in</p>
          <p className="tag">post-booking follow-up</p>
        </div>
      </div>

      {/* Timeline progress */}
      <div className="flex items-center gap-2 mb-8 ml-14">
        {checkIns.map((ci) => {
          const done = answeredDays.has(ci.day);
          const active = ci.day === currentDay;
          return (
            <span
              key={ci.day}
              className={`h-px flex-1 transition-colors ${
                done || active
                  ? "bg-[color:var(--accent)]"
                  : "bg-[color:var(--hairline)]"
              }`}
            />
          );
        })}
      </div>

      {/* Welcome back banner — only show when we have prior responses
          and the full set isn't complete. Tells the user the loop
          compounds: "this is the magic they came back for." */}
      {!isComplete &&
        responses.length > 0 &&
        currentCheckIn !== null && (
          <div className="ml-14 mb-6 fade-in-up">
            <p className="text-xs text-[color:var(--muted)] mb-3 leading-relaxed italic max-w-prose">
              You&apos;ve already told me {responses.length === 1 ? "once" : `${responses.length} things`}.
              I&apos;ve kept them with me. Pick up where you left off.
            </p>
            <ul className="space-y-1.5 mb-1">
              {responses.map((r) => (
                <li
                  key={r.day}
                  className="text-xs text-[color:var(--muted)] flex items-center gap-2"
                >
                  <span className="tag">Day {r.day}</span>
                  <span>→</span>
                  <span>{r.answer}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      {/* Complete state — full recap of adapted plan */}
      {isComplete ? (
        <div className="ml-14 fade-in-up">
          <div className="flex items-start gap-3 mb-6">
            <MiraOrb size={32} state="calm" className="flex-shrink-0 mt-0.5" />
            <div className="space-y-3 flex-1">
              <p className="text-sm leading-relaxed mira-line">
                I&apos;ve adjusted your preparation plan based on what you told me.
                Here&apos;s what changed:
              </p>
            </div>
          </div>

          <ul className="space-y-3 ml-11">
            {responses.map((r, i) => (
              <li
                key={r.day}
                className={`mira-line mira-line-${Math.min(i + 1, 5)}`}
              >
                <p className="tag mb-1">Day {r.day}</p>
                <p className="text-sm leading-relaxed text-[color:var(--muted)]">
                  You said: <em>{r.answer}</em>
                </p>
                <p className="text-sm leading-relaxed mt-1">
                  {r.adaptedPlan}
                </p>
              </li>
            ))}
          </ul>

          <div className="flex items-start gap-3 mt-6 ml-11">
            <MiraOrb size={28} state="speaking" className="flex-shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed italic mira-line">
              I&apos;ll check in again when you&apos;re back. Go well.
            </p>
          </div>
        </div>
      ) : currentCheckIn ? (
        /* Active check-in */
        <div className="ml-14">
          <p className="tag mb-2">{currentCheckIn.label}</p>

          <div className="flex items-start gap-3 mb-4">
            <MiraOrb size={32} state="speaking" className="flex-shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed mira-line">
              {currentCheckIn.miraSays}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 ml-11">
            {currentCheckIn.options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => respond(opt.label, opt.adaptsTo)}
                className="px-3 py-1.5 rounded-sm text-xs border border-[color:var(--hairline)] hover:border-[color:var(--accent-soft)] hover:bg-[color:var(--surface)] transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
