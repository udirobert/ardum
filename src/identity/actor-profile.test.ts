import { afterEach, describe, expect, it } from "vitest";
import {
  normalizePreferredName,
  EMPTY_PROFILE,
} from "./actor-profile";
import * as local from "./actor-profile-local";

// Reset the in-memory store between tests so state doesn't leak.
afterEach(() => {
  globalThis.__ardumActorProfiles?.clear();
});

describe("normalizePreferredName", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizePreferredName("  Sarah  ")).toBe("Sarah");
  });

  it("caps at 80 characters", () => {
    const long = "A".repeat(120);
    expect(normalizePreferredName(long)).toHaveLength(80);
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(normalizePreferredName("")).toBeNull();
    expect(normalizePreferredName("   ")).toBeNull();
  });

  it("preserves internal spacing", () => {
    expect(normalizePreferredName("Mary Jane")).toBe("Mary Jane");
  });
});

describe("actor-profile-local adapter", () => {
  it("returns EMPTY_PROFILE for an unknown actor", async () => {
    const profile = await local.get("actor-unknown");
    expect(profile).toEqual(EMPTY_PROFILE);
    expect(profile.preferredName).toBeNull();
    expect(profile.profile).toEqual({});
  });

  it("round-trips a preferred name through update and get", async () => {
    await local.update("actor-1", { preferredName: "Sarah" });
    const profile = await local.get("actor-1");
    expect(profile.preferredName).toBe("Sarah");
  });

  it("clears preferredName when set to null", async () => {
    await local.update("actor-1", { preferredName: "Sarah" });
    await local.update("actor-1", { preferredName: null });
    const profile = await local.get("actor-1");
    expect(profile.preferredName).toBeNull();
  });

  it("preserves preferredName when patching only profile", async () => {
    await local.update("actor-1", { preferredName: "Sarah" });
    await local.update("actor-1", { profile: { dietary: "vegan" } });
    const profile = await local.get("actor-1");
    expect(profile.preferredName).toBe("Sarah");
    expect(profile.profile).toEqual({ dietary: "vegan" });
  });

  it("preserves profile when patching only preferredName", async () => {
    await local.update("actor-1", { profile: { dietary: "vegan" } });
    await local.update("actor-1", { preferredName: "Sarah" });
    const profile = await local.get("actor-1");
    expect(profile.preferredName).toBe("Sarah");
    expect(profile.profile).toEqual({ dietary: "vegan" });
  });

  it("does not share references between get calls (clone isolation)", async () => {
    await local.update("actor-1", { profile: { dietary: "vegan" } });
    const a = await local.get("actor-1");
    const b = await local.get("actor-1");
    expect(a.profile).not.toBe(b.profile);
    expect(a.profile).toEqual(b.profile);
  });

  it("attachExternalSubject is a no-op in local mode", async () => {
    // The local adapter does not model external_subject; the call must
    // succeed without error so the client-side attach path works in demo.
    await expect(
      local.attachExternalSubject("actor-1", "0xwallet"),
    ).resolves.toBeUndefined();
  });
});
