// Client-side aesthetic vector cache — drives the Mira orb palette.
// localStorage persists across visits on this device (disposable cache).

import {
  NEUTRAL_VECTOR,
  type AestheticVector,
  type UserPreference,
  emptyPreference,
} from "./image-pool";

const VECTOR_KEY = "ardum:aesthetic-vector";
const PREF_KEY = "ardum:aesthetic-pref";

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, value);
  sessionStorage.removeItem(key);
}

export function readAestheticVector(): AestheticVector {
  if (typeof window === "undefined") return NEUTRAL_VECTOR;
  try {
    const raw = readStorage(VECTOR_KEY);
    if (!raw) return NEUTRAL_VECTOR;
    return { ...NEUTRAL_VECTOR, ...JSON.parse(raw) };
  } catch {
    return NEUTRAL_VECTOR;
  }
}

export function writeAestheticVector(vector: AestheticVector): void {
  writeStorage(VECTOR_KEY, JSON.stringify(vector));
}

export function readAestheticPreference(): UserPreference {
  if (typeof window === "undefined") return emptyPreference();
  try {
    const raw = readStorage(PREF_KEY);
    if (!raw) return emptyPreference();
    return JSON.parse(raw) as UserPreference;
  } catch {
    return emptyPreference();
  }
}

export function writeAestheticPreference(pref: UserPreference): void {
  writeStorage(PREF_KEY, JSON.stringify(pref));
  writeAestheticVector(pref.vector);
}

export function hasCompletedAestheticCalibration(): boolean {
  if (typeof window === "undefined") return false;
  const pref = readAestheticPreference();
  return pref.interactions.length >= 4;
}
