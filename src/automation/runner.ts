import "server-only";

import { episodeRepository } from "@/episodes/repository";
import { applyEpisodeCommand } from "@/episodes/service";
import { log } from "@/lib/observability";

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
    } catch (error) {
      failed += 1;
      log.warn("automation.tick_failed", {
        episodeId: episode.id,
        revision: episode.revision,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  log.info("automation.tick_complete", { checked, failed, total: due.length });
  return { checked, failed };
}
