// Shared utility: derive an AestheticVector from intake answers.
// Used by the Intake (to drive the cloud field and orb during the
// conversation) and by the match page (to drive the reasoning-phase
// atmosphere and the vision's cloud field before the aesthetic journey
// has completed).

import type { AestheticVector } from "@/aesthetics/image-pool";
import type { PractitionerProfile } from "./schema";

export function intakeAnswersToVector(
  answers: Partial<Pick<PractitionerProfile, "energy" | "budget" | "social">>,
): AestheticVector {
  const base: AestheticVector = {
    ocean: 0.5, mountain: 0.5, jungle: 0.5, desert: 0.5, forest: 0.5,
    warm: 0.5, cool: 0.5, minimal: 0.5, ornate: 0.5,
    light: 0.5, dark: 0.5,
    calming: 0.5, energizing: 0.5, expansive: 0.5, intimate: 0.5,
  };
  // Energy answer drives warm/cool/calming/energizing/light/dark
  if (answers.energy === "settled") {
    base.warm = 0.75; base.cool = 0.25;
    base.calming = 0.8; base.energizing = 0.2;
    base.dark = 0.4; base.light = 0.6;
  } else if (answers.energy === "in-movement") {
    base.warm = 0.7; base.cool = 0.3;
    base.energizing = 0.7; base.calming = 0.3;
    base.expansive = 0.65; base.intimate = 0.35;
  } else if (answers.energy === "low") {
    base.cool = 0.6; base.warm = 0.4;
    base.calming = 0.85; base.energizing = 0.15;
    base.dark = 0.55; base.light = 0.45;
    base.intimate = 0.65; base.expansive = 0.35;
  } else if (answers.energy === "sharp") {
    base.light = 0.75; base.dark = 0.25;
    base.energizing = 0.8; base.calming = 0.2;
    base.cool = 0.55; base.warm = 0.45;
  }
  // Social comfort nudges expansive/intimate axis
  if (answers.social === "solo") {
    base.intimate = Math.min(1, base.intimate + 0.2);
    base.expansive = Math.max(0, base.expansive - 0.2);
  } else if (answers.social === "communal") {
    base.expansive = Math.min(1, base.expansive + 0.2);
    base.intimate = Math.max(0, base.intimate - 0.2);
  }
  return base;
}
