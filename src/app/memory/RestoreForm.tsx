"use client";

// The inner form for cross-device restore. Must be rendered inside
// MagicAuthProvider. Lazy-loaded so the Magic SDK only loads when the
// practitioner opens the restore flow.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useMagicAuth } from "@/booking/MagicAuth";

const RESTORE_PREFIX = "Ardum cross-device restore v1";

export default function RestoreForm() {
  const router = useRouter();
  const { connectWithUI, signPersonalMessage, configured, sessionReady } =
    useMagicAuth();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function restore() {
    setError(null);
    setStatus(null);
    if (!configured) {
      setError("Magic is not configured. Set NEXT_PUBLIC_MAGIC_API_KEY.");
      return;
    }
    startTransition(async () => {
      try {
        setStatus("Connecting to Magic…");
        const address = await connectWithUI();
        if (!address) {
          setError("Could not connect. Please try again.");
          return;
        }

        const timestamp = Math.floor(Date.now() / 1000);
        const message = [
          RESTORE_PREFIX,
          `address: ${address}`,
          `timestamp: ${timestamp}`,
        ].join("\n");

        setStatus("Sign the message to verify your identity…");
        const signature = await signPersonalMessage(message);

        setStatus("Restoring your intentions…");
        const res = await fetch("/api/actor/restore", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address, signature, timestamp }),
        });
        const data = (await res.json()) as {
          restored?: boolean;
          error?: string;
        };
        if (!res.ok || !data.restored) {
          throw new Error(
            data.error ?? "Could not restore. No existing identity found.",
          );
        }
        setStatus("Restored. Loading your intentions…");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Restore failed.");
        setStatus(null);
      }
    });
  }

  if (!sessionReady) {
    return <p className="text-sm text-[color:var(--muted)] mb-10">Loading…</p>;
  }

  return (
    <div className="mb-10">
      <p className="tag mb-2">restore your identity</p>
      <p className="text-sm text-[color:var(--muted)] mb-3 leading-relaxed">
        Sign in with the same account you used on your other device. Mira will
        verify your identity and bring your intentions here.
      </p>
      <button
        type="button"
        onClick={restore}
        disabled={pending || !configured}
        className="px-5 py-2.5 rounded-sm disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: "var(--foreground)", color: "var(--background)" }}
      >
        {pending ? status ?? "Working…" : "Sign in to restore →"}
      </button>
      {status && pending && (
        <p className="mt-2 text-sm text-[color:var(--muted)]">{status}</p>
      )}
      {error && (
        <p className="mt-2 text-sm" role="alert" style={{ color: "#c66" }}>
          {error}
        </p>
      )}
    </div>
  );
}
