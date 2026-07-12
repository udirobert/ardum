// Service-side observation hook into semantic memory.
//
// The episode service flips transitions (recommend, record-commitment)
// that we want Cognee to remember for later recall. This module is the
// only place outside the Cognee adapter that talks to it: it is
// deliberately NOT in src/memory/projector.ts because that file's
// stated contract is "No env reads, no async, no SDK imports." Folding
// a side-effecting helper into a pure projector would force every
// importer to drag in `cognee.ts`'s `import "server-only"` even when
// it only wanted the projector.
//
// `fireSemanticRemember` is best-effort by design: the call is
// un-awaited (the request response must never block on Cognee) and
// the `.catch()` is a belt-and-suspenders defense — cogneeMemory
// already swallows errors silently and is a no-op when unconfigured.
// An episode transition must never be derailed by optional memory.
import { cogneeMemory } from "./cognee";

export function fireSemanticRemember(
  actorId: string,
  phrase: string,
): void {
  void cogneeMemory.remember(actorId, phrase).catch(() => {});
}
