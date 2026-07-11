import "server-only";

import { episodeRepository } from "@/episodes/repository";
import { applyEpisodeCommand } from "@/episodes/service";

export async function runDueAutomation(now = new Date()): Promise<{
  checked: number;
  failed: number;
}> {
  const due = await episodeRepository.listDue(now);
  let checked = 0;
  let failed = 0;
  for (const episode of due) {
    try {
      await applyEpisodeCommand(
        episode.actorId,
        episode.id,
        { type: "check-monitor", expectedRevision: episode.revision },
        { clock: { now: () => now } },
      );
      checked += 1;
    } catch {
      failed += 1;
    }
  }
  return { checked, failed };
}
