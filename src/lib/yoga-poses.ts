/**
 * Curated yoga pose illustrations sourced from the yoga-api project.
 * SVGs are served from Cloudinary CDN (fl_sanitize — XSS-clean, stable URLs).
 *
 * We self-host the pose *metadata* here so PoseCheck and future retreat cards
 * don't depend on the yoga-api runtime (which has 503s per its own README).
 *
 * Poses are tagged by the signals the MediaPipe baseline produces so we can
 * show contextually relevant asana illustrations during/after pose sampling.
 */

export type YogaPose = {
  id: number;
  english: string;
  sanskrit: string;
  /** Cloudinary fl_sanitize SVG — XSS-safe, no JS execution */
  svgUrl: string;
  /** Short benefit copy for captions */
  benefit: string;
  /** Which baseline shoulder mobility values this pose appears for */
  shoulder?: ("tight" | "open" | "very-open")[];
  /** Which baseline hip mobility values this pose appears for */
  hip?: ("tight" | "open" | "very-open")[];
  /** Which breath phase values this pose appears for */
  breath?: ("shallow" | "even" | "extended")[];
  /** Broad energy tags for intake-step illustrations */
  energy?: ("settled" | "in-movement" | "low" | "sharp")[];
};

export const YOGA_POSES: YogaPose[] = [
  {
    id: 10,
    english: "Child's Pose",
    sanskrit: "Balāsana",
    svgUrl:
      "https://res.cloudinary.com/dko1be2jy/image/upload/fl_sanitize/v1676483079/yoga-api/10_wzpo85.svg",
    benefit: "Calms the brain · relieves stress and fatigue",
    shoulder: ["tight", "open"],
    hip: ["tight"],
    breath: ["shallow"],
    energy: ["low", "settled"],
  },
  {
    id: 11,
    english: "Corpse",
    sanskrit: "Śavāsana",
    svgUrl:
      "https://res.cloudinary.com/dko1be2jy/image/upload/fl_sanitize/v1676483078/yoga-api/11_dczyrp.svg",
    benefit: "Reduces fatigue · lowers blood pressure",
    shoulder: ["tight"],
    hip: ["tight"],
    breath: ["shallow", "even"],
    energy: ["low"],
  },
  {
    id: 5,
    english: "Butterfly",
    sanskrit: "Baddha Koṇāsana",
    svgUrl:
      "https://res.cloudinary.com/dko1be2jy/image/upload/fl_sanitize/v1676483074/yoga-api/5_i64gif.svg",
    benefit: "Opens the hips and groins · stretches the back",
    shoulder: ["open"],
    hip: ["open", "very-open"],
    breath: ["even"],
    energy: ["settled"],
  },
  {
    id: 30,
    english: "Seated Forward Bend",
    sanskrit: "Paśchimottānāsana",
    svgUrl:
      "https://res.cloudinary.com/dko1be2jy/image/upload/fl_sanitize/v1676483091/yoga-api/30_gumpl3.svg",
    benefit: "Calms the brain · stretches the spine and hamstrings",
    shoulder: ["open", "very-open"],
    hip: ["open", "very-open"],
    breath: ["extended"],
    energy: ["settled", "low"],
  },
  {
    id: 38,
    english: "Standing Forward Bend",
    sanskrit: "Uttānāsana",
    svgUrl:
      "https://res.cloudinary.com/dko1be2jy/image/upload/fl_sanitize/v1676483093/yoga-api/38_yb3thk.svg",
    benefit: "Relieves stress · stretches hamstrings and calves",
    shoulder: ["open"],
    hip: ["open"],
    breath: ["even"],
    energy: ["in-movement"],
  },
  {
    id: 44,
    english: "Warrior One",
    sanskrit: "Vīrabhadrāsana I",
    svgUrl:
      "https://res.cloudinary.com/dko1be2jy/image/upload/fl_sanitize/v1676483096/yoga-api/44_dqeayo.svg",
    benefit: "Stretches chest and lungs · strengthens thighs and ankles",
    shoulder: ["open", "very-open"],
    hip: ["open"],
    breath: ["even"],
    energy: ["in-movement", "sharp"],
  },
  {
    id: 45,
    english: "Warrior Two",
    sanskrit: "Vīrabhadrāsana II",
    svgUrl:
      "https://res.cloudinary.com/dko1be2jy/image/upload/fl_sanitize/v1676483096/yoga-api/45_ehimr1.svg",
    benefit: "Strengthens legs and ankles · increases stamina",
    shoulder: ["very-open"],
    hip: ["very-open"],
    breath: ["even", "extended"],
    energy: ["sharp", "in-movement"],
  },
  {
    id: 42,
    english: "Triangle",
    sanskrit: "Trikoṇāsana",
    svgUrl:
      "https://res.cloudinary.com/dko1be2jy/image/upload/fl_sanitize/v1676483096/yoga-api/42_jawxqw.svg",
    benefit: "Stretches hips and spine · helps relieve stress",
    shoulder: ["very-open"],
    hip: ["open", "very-open"],
    breath: ["even"],
    energy: ["in-movement", "sharp"],
  },
  {
    id: 9,
    english: "Chair",
    sanskrit: "Utkaṭāsana",
    svgUrl:
      "https://res.cloudinary.com/dko1be2jy/image/upload/fl_sanitize/v1676483078/yoga-api/9_ewvoun.svg",
    benefit: "Energises the entire body · strengthens ankles and spine",
    shoulder: ["open", "very-open"],
    hip: ["tight"],
    breath: ["shallow"],
    energy: ["sharp"],
  },
  {
    id: 23,
    english: "Low Lunge",
    sanskrit: "Aṅjaneyāsana",
    svgUrl:
      "https://res.cloudinary.com/dko1be2jy/image/upload/fl_sanitize/v1676483086/yoga-api/23_k2jccj.svg",
    benefit: "Stretches chest, lungs and groin · strengthens back",
    shoulder: ["open"],
    hip: ["open"],
    breath: ["even"],
    energy: ["in-movement"],
  },
  {
    id: 35,
    english: "Sphinx",
    sanskrit: "Sālamba Bhujaṅgāsana",
    svgUrl:
      "https://res.cloudinary.com/dko1be2jy/image/upload/fl_sanitize/v1676483092/yoga-api/35_dytwvz.svg",
    benefit: "Strengthens the spine · opens the heart and lungs",
    shoulder: ["open"],
    hip: ["tight"],
    breath: ["extended"],
    energy: ["settled"],
  },
  {
    id: 37,
    english: "Garland Pose",
    sanskrit: "Mālāsana",
    svgUrl:
      "https://res.cloudinary.com/dko1be2jy/image/upload/fl_sanitize/v1676483093/yoga-api/37_moh7ii.svg",
    benefit: "Stretches ankles, groins and back torso · tones belly",
    shoulder: ["tight", "open"],
    hip: ["very-open"],
    breath: ["even"],
    energy: ["settled", "in-movement"],
  },
  {
    id: 7,
    english: "Cat",
    sanskrit: "Marjaryāsana",
    svgUrl:
      "https://res.cloudinary.com/dko1be2jy/image/upload/fl_sanitize/v1676483075/yoga-api/7_a6aspg.svg",
    benefit: "Relieves spine and neck · energises the body",
    shoulder: ["tight", "open"],
    hip: ["tight", "open"],
    breath: ["shallow", "even"],
    energy: ["low", "settled"],
  },
  {
    id: 8,
    english: "Cow",
    sanskrit: "Bitilāsana",
    svgUrl:
      "https://res.cloudinary.com/dko1be2jy/image/upload/fl_sanitize/v1676483077/yoga-api/8_wi10sn.svg",
    benefit: "Removes fatigue · improves breathing and circulation",
    shoulder: ["tight", "open"],
    hip: ["tight", "open"],
    breath: ["even"],
    energy: ["low", "settled"],
  },
];

/**
 * Return poses relevant to a given MediaPipe baseline.
 * Falls back to a neutral selection if no strong matches.
 */
export function posesForBaseline(baseline: {
  shoulderMobility: "tight" | "open" | "very-open";
  hipMobility: "tight" | "open" | "very-open";
  breathPhase: "shallow" | "even" | "extended";
}): YogaPose[] {
  const scored = YOGA_POSES.map((p) => {
    let score = 0;
    if (p.shoulder?.includes(baseline.shoulderMobility)) score += 1;
    if (p.hip?.includes(baseline.hipMobility)) score += 1;
    if (p.breath?.includes(baseline.breathPhase)) score += 1;
    return { pose: p, score };
  });
  const top = scored
    .filter((s) => s.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.pose);
  // Always return at least two poses — fall back to settled/neutral picks.
  if (top.length >= 2) return top;
  return YOGA_POSES.filter(
    (p) => p.energy?.includes("settled") || p.breath?.includes("even")
  ).slice(0, 3);
}

/**
 * Return a single pose illustration for a given intake energy answer.
 * Used in the intake steps as ambient visual accompaniment.
 */
export function poseForEnergy(
  energy: "settled" | "in-movement" | "low" | "sharp"
): YogaPose {
  const matches = YOGA_POSES.filter((p) => p.energy?.includes(energy));
  // Pick deterministically — stable hash of the energy string.
  const idx = energy.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return matches[idx % matches.length] ?? YOGA_POSES[0];
}
