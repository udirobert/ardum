"use client";

// ADR 0011 §3: cross-device restore UI on /memory.
//
// A practitioner on a new device (no episodes visible) can sign in with
// Magic to restore their existing identity. The flow:
//   1. Connect with Magic (social login → wallet address)
//   2. Sign a canonical message proving wallet ownership
//   3. POST to /api/actor/restore — server verifies, finds the actor
//      by external_subject, re-signs the cookie
//   4. Refresh the page — episodes and profile now appear
//
// This component wraps itself in MagicAuthProvider so /memory doesn't
// need to mount it at the page level. Magic loads lazily only when the
// practitioner clicks "Continue on another device."

import { useState, useTransition, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { MagicAuthProvider, useMagicAuth } from "@/booking/MagicAuth";

const RestoreForm = lazy(() => import("./RestoreForm"));

export default function RestoreIdentity() {
  const [opened, setOpened] = useState(false);

  if (!opened) {
    return (
      <div className="mb-10">
        <p className="tag mb-2">on another device?</p>
        <p className="text-sm text-[color:var(--muted)] mb-3 leading-relaxed">
          If you started on another device and signed in with Magic, you can
          restore your intentions here.
        </p>
        <button
          type="button"
          onClick={() => setOpened(true)}
          className="px-5 py-2.5 rounded-sm border text-sm"
          style={{ borderColor: "var(--hairline)" }}
        >
          Continue on another device →
        </button>
      </div>
    );
  }

  return (
    <MagicAuthProvider>
      <Suspense fallback={<p className="text-sm text-[color:var(--muted)] mb-10">Loading…</p>}>
        <RestoreForm />
      </Suspense>
    </MagicAuthProvider>
  );
}
