"use client";

// MiraCheckIn — post-booking scheduled follow-ups.
//
// After booking, Mira sends timed check-in messages. The user can
// respond, and Mira adapts the preparation plan based on their
// responses. This turns a booking into a relationship.
//
// For the hackathon demo, we simulate the timeline — the user can
// step through each check-in day and see how Mira's guidance
// adapts. In production, these would be triggered by a cron job
// or scheduled task.

import { useState } from "react";
import MiraOrb from "@/components/MiraOrb";

type MiraCheckInProps = {
  retreatTitle: string;
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
};

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

export default function MiraCheckIn({ retreatTitle, signals }: MiraCheckInProps) {
  const checkIns = buildCheckIns(retreatTitle, signals);
  const [currentDay, setCurrentDay] = useState(0);
  const [responses, setResponses] = useState<Response[]>([]);

  const currentCheckIn = checkIns[currentDay];

  function respond(answer: string, adaptsTo: string) {
    setResponses([...responses, { day: currentCheckIn.day, answer, adaptedPlan: adaptsTo }]);
    if (currentDay < checkIns.length - 1) {
      setCurrentDay(currentDay + 1);
    }
  }

  const isComplete = responses.length === checkIns.length;

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
        {checkIns.map((ci, i) => (
          <span
            key={ci.day}
            className={`h-px flex-1 transition-colors ${
              i < currentDay || (isComplete && i === currentDay)
                ? "bg-[color:var(--accent)]"
                : i === currentDay
                  ? "bg-[color:var(--accent)]"
                  : "bg-[color:var(--hairline)]"
            }`}
          />
        ))}
      </div>

      {/* Complete state — summary of adapted plan */}
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
      ) : (
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

          {/* Previous responses */}
          {responses.length > 0 && (
            <div className="mt-6 space-y-2">
              {responses.map((r) => (
                <div key={r.day} className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
                  <span className="tag">Day {r.day}</span>
                  <span>→</span>
                  <span>{r.answer}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
