import type {
  CoordinationProvider,
  HoldProvider,
  MonitoringProvider,
} from "./contracts";

const HOURS = 60 * 60 * 1000;

function stableNumber(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

export const localMonitoringProvider: MonitoringProvider = {
  async observe({ retreatId, listedPriceUsd, checkedAt, observationId }) {
    const cycle = Math.floor(checkedAt.getTime() / (12 * HOURS));
    const signal = stableNumber(`${retreatId}:${cycle}`);
    const available = signal % 5 !== 0;
    const priceDelta = (signal % 3) * 25;
    return {
      id: observationId,
      available,
      priceUsd: listedPriceUsd + priceDelta,
      observedAt: checkedAt.toISOString(),
      summary: available
        ? `Availability is open at $${(listedPriceUsd + priceDelta).toLocaleString()}.`
        : "No planning hold is available in this check.",
    };
  },
};

export const localHoldProvider: HoldProvider = {
  async create({ retreatId, now, holdId }) {
    return {
      id: holdId,
      retreatId,
      status: "active",
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 48 * HOURS).toISOString(),
      provider: "local",
    };
  },
  async release(hold, now) {
    return {
      ...hold,
      status:
        new Date(hold.expiresAt).getTime() <= now.getTime()
          ? "expired"
          : "released",
    };
  },
};

export const localCoordinationProvider: CoordinationProvider = {
  async createInvite({ token, now }) {
    return {
      token,
      expiresAt: new Date(now.getTime() + 72 * HOURS).toISOString(),
    };
  },
};
