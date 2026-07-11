import type {
  MonitorObservation,
  SoftHold,
} from "@/episodes/model";

export type Clock = {
  now(): Date;
};

export type IdFactory = {
  create(): string;
};

export type MonitoringProvider = {
  observe(input: {
    retreatId: string;
    listedPriceUsd: number;
    checkedAt: Date;
    observationId: string;
  }): Promise<MonitorObservation>;
};

export type HoldProvider = {
  create(input: {
    retreatId: string;
    now: Date;
    holdId: string;
  }): Promise<SoftHold>;
  release(hold: SoftHold, now: Date): Promise<SoftHold>;
};

export type CoordinationProvider = {
  createInvite(input: {
    episodeId: string;
    participantName: string;
    token: string;
    now: Date;
  }): Promise<{ token: string; expiresAt: string }>;
};

export const systemClock: Clock = {
  now: () => new Date(),
};

export const cryptoIds: IdFactory = {
  create: () => crypto.randomUUID(),
};
