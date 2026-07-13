"use client";

import { useEffect, useState } from "react";
import MiraOrb from "@/components/MiraOrb";
import { presenceFromActivity } from "@/agent/mira-presence";

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
    <section className="mx-auto max-w-xl px-6 sm:px-10 py-20 text-center">
      <div className="flex justify-center mb-7">
        <MiraOrb
          size={72}
          presence={presenceFromActivity("idle")}
          activity={busy ? "processing" : "idle"}
        />
      </div>
      {done ? (
        <>
          <p className="tag mb-3">response received</p>
          <h1 className="font-serif text-4xl tracking-tight">
            Thank you. Mira will carry that back.
          </h1>
        </>
      ) : error ? (
        <>
          <p className="tag mb-3">invitation unavailable</p>
          <h1 className="font-serif text-4xl tracking-tight mb-4">
            This link can no longer be used.
          </h1>
          <p className="text-[color:var(--muted)]">{error}</p>
        </>
      ) : !invitation ? (
        <p aria-live="polite">Opening the invitation…</p>
      ) : (
        <>
          <p className="tag mb-3">a private planning invitation</p>
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight mb-5">
            {invitation.participantName}, can this plan include you?
          </h1>
          <p className="text-[color:var(--muted)] mb-8">
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
                className="px-5 py-3 rounded-sm border border-[color:var(--hairline)] capitalize disabled:opacity-40"
              >
                {decision}
              </button>
            ))}
          </div>
          <p className="tag mt-6">
            expires {new Date(invitation.expiresAt).toLocaleString()}
          </p>
        </>
      )}
    </section>
  );
}
