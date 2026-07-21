import type { Episode } from "@/episodes/model";

export type WiderApertureContribution = {
  grantedAt: string;
  revokedAt?: string;
};

export function hasActiveContribution(episode: Episode): boolean {
  const grant = episode.widerApertureContribution;
  return Boolean(grant?.grantedAt && !grant.revokedAt);
}

export function contributionEligibleEpisodes(episodes: Episode[]): Episode[] {
  return episodes.filter(hasActiveContribution);
}
