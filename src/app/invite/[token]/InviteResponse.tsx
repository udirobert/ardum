"use client";

import { useEffect, useState } from "react";
import { preloadMiraScene } from "@/components/MiraOrb";
import { useMiraField } from "@/components/MiraField";
import { DUSK_PANEL } from "@/aesthetics/dusk-theme";

// Warm the hero scene chunk as soon as the invite bundle evaluates — the
// shell field is this page's atmosphere.
preloadMiraScene();

type Invitation = {
  participantName: string;
  expiresAt: string;
  responded: boolean;
};

export default function InviteResponse({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setInvitation(data.invitation);
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Invitation unavailable."),
      );
  }, [token]);

  useMiraField({
    activity: busy ? "processing" : "idle",
  });

  async function respond(decision: "yes" | "no" | "unsure") {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/invites/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not respond.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="dusk mx-auto max-w-xl w-full px-6 sm:px-10 py-14 text-center min-h-[calc(100svh-56px)] flex flex-col">
      {done ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="tag mb-3">response received</p>
          <h1 className="font-serif text-4xl tracking-tight">
            Thank you. Mira will carry that back.
          </h1>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="tag mb-3">invitation unavailable</p>
          <h1 className="font-serif text-4xl tracking-tight mb-4">
            This link can no longer be used.
          </h1>
          <p className="text-[color:var(--muted)]">{error}</p>
        </div>
      ) : !invitation ? (
        <p
          aria-live="polite"
          className="flex-1 flex items-center justify-center"
        >
          Opening the invitation…
        </p>
      ) : (
        <div className="flex-1 flex flex-col justify-between">
          {/* Question above the orb's glow, the answer grounded below it. */}
          <div>
            <p className="tag mb-3">a private planning invitation</p>
            <h1 className="font-serif text-4xl sm:text-5xl tracking-tight">
              {invitation.participantName}, can this plan include you?
            </h1>
          </div>
          <div
            className="max-w-md w-full mx-auto rounded-xl border backdrop-blur-md px-5 py-6 sm:px-8"
            style={DUSK_PANEL}
          >
            <p className="text-[color:var(--muted)] mb-6">
              Your answer is shared with the organizer. Their private intention
              and constraints have not been included in this link.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {(["yes", "unsure", "no"] as const).map((decision) => (
                <button
                  key={decision}
                  type="button"
                  disabled={busy || invitation.responded}
                  onClick={() => respond(decision)}
                  className="px-5 py-3 rounded-sm border border-[color:var(--hairline)] capitalize disabled:opacity-40 hover:border-[color:var(--accent)]"
                >
                  {decision}
                </button>
              ))}
            </div>
            <p className="tag mt-6">
              expires {new Date(invitation.expiresAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
