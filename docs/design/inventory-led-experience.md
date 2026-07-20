# Inventory-Led Experience: Replacing the Quiz with Exploration

## Executive Summary

**Problem:** The current multiple-choice clarification flow (energy/budget/social questions) creates cognitive load and feels like a quiz rather than a peaceful, guided experience. Users are forced to introspect into abstract categories ("Settled / In movement / Low / Sharp") when they should be reacting to concrete offerings.

**Solution:** Lead with real retreat inventory. Show users what we have immediately, then extract structured data through natural conversation about real retreats, not abstract questions.

**Strategic Wedge:** This pattern differentiates Ardum from general-purpose LLMs (ChatGPT, Claude, Gemini) by showcasing proprietary supply and domain expertise in the first 30 seconds. General LLMs ask "what are you looking for?" and give generic answers. Ardum shows real retreats with real operators, real photos, real dates, real prices.

**This is a showcase build.** The goal is not a conservative MVP. It is a jaw-dropping, partner-reactivating demo that proves Ardum can treat retreat inventory like high-end art and handle the logic flawlessly.

---

## Strategic Foundation

### Peter Thiel's Monopoly Question

**What do we have that ChatGPT doesn't?**

- Proprietary retreat inventory (real operators, real availability)
- Domain-specific ranking policy (deterministic, inspectable, tuned for yoga retreats)
- Transaction infrastructure (holds, bookings, coordination, on-chain settlement)
- Curated, vetted inventory (not hallucinated)

The moat isn't the conversation. The moat is the **stuff**.

### Paul Graham's "Do Things That Don't Scale"

**What can we show in the first 30 seconds that signals "this is not ChatGPT"?**

Real retreats. Beautifully presented, with hero images, locations, dates, prices, and operator bios. Immediate category signal. Immediate specificity. Immediate value.

### The Quiz Problem (Cognitive Load Analysis)

The current flow violates the product vision's core principle: **"One decision at a time."**

```
Current (quiz pattern):
1. "the next decision" tag → assessment framing
2. "How is your energy?" → 4 abstract options
3. "What's your budget?" → 4 price bands
4. "What's your social preference?" → 4 configurations

User must:
- Introspect into abstract categories
- Self-diagnose their current state
- Match internal feelings to your taxonomy
- Answer three consecutive questions
```

This is a questionnaire, regardless of how beautiful the orbs and staggered reveals are.

### The Inventory-Led Alternative

```
New (exploration pattern):
1. User: "I need a quiet week before October"
2. Show 3 real retreats (beautifully presented)
3. User: "That first one looks too expensive"
4. Transition: old retreats animate out, new ones in
5. User: "The second one is perfect. Is it still available?"
6. Commitment flow

User reactions to real things:
- "Too expensive"
- "That's too far"
- "I need something shorter"
- "I want to go alone"
- "What about dates in September?"
```

Structured data (energy/budget/social) is extracted from conversation about real retreats, not asked as abstract questions.

---

## Execution Plan: Two Parallel Tracks

This plan is designed for **two people working in parallel**, with a single shared contract agreed on Day 1. The split is by domain, not by sequence:

### Track A: Intelligence & State (Person A)

**Owns the "stuff" and the brain.**

- Retreat catalog curation and schema
- Deterministic ranking integration
- Conversation extraction and state updates
- Episode service wiring
- Real operator data and availability

### Track B: Motion & Atmosphere (Person B)

**Owns the "jaw-dropping" feel.**

- Core presentation components
- Sticky scroll and R3F carousel
- Motion path transitions
- Ambient gradient canvas
- WebGPU commitment transition

### Why This Split Works

Track B can build the entire visual experience against a static mock catalog while Track A builds the live data and extraction engine. The only hard dependency is the `Retreat` interface, agreed on Day 1.

---

## The Shared Contract (Day 1 Agreement)

Before anyone writes code, agree on these two contracts so both tracks can work in parallel:

### 1. The `Retreat` Presentation Schema

```typescript
// src/inventory/retreat.ts
export interface Retreat {
  id: string;
  title: string;
  location: string;
  heroImage: string;
  gallery: string[];
  operator: {
    name: string;
    bio: string;
    avatar: string;
  };
  dates: {
    start: string;
    end: string;
    duration: number; // days
  };
  price: {
    amount: number;
    currency: string;
    includes: string[];
  };
  capacity: {
    min: number;
    max: number;
    current: number;
  };
  description: string;
  highlights: string[];
  attestationId?: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
}
```

### 2. The React State Contract

Track B exposes a callback. Track A implements the engine.

```typescript
// Track B expects:
interface RetreatExplorationProps {
  retreats: Retreat[];
  miraNote?: string;
  state: ExplorationState;
  onUserMessage: (text: string) => void;
  onCommit: (retreatId: string) => void;
}

type ExplorationState = 
  | "loading"      // Initial fetch
  | "idle"         // Retreats displayed
  | "extracting"   // Processing user message
  | "transitioning" // Old retreats leaving, new ones entering
  | "error"        // Extraction failed
  | "committing";  // WebGPU transition

// Track A delivers:
function useRetreatExploration(episodeId: string) {
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [miraNote, setMiraNote] = useState<string>("");
  const [state, setState] = useState<ExplorationState>("loading");

  const onUserMessage = async (text: string) => {
    setState("extracting");
    // Extract constraints, re-rank, generate miraNote
    setState("transitioning");
    // Update retreats array (Person B watches for identity change)
    setState("idle");
  };

  return { retreats, miraNote, state, onUserMessage };
}
```

**Reactive Contract:** Person B watches `retreats` array identity changes to trigger motion path transitions. No explicit callback needed.

### 3. Mira's Note Generation (Track A Responsibility)

When re-ranking retreats, Track A also produces a contextual `miraNote` string that explains what changed and why. Examples:

- "These all fit within your budget now."
- "Here are some shorter options for your timeline."
- "I found retreats that specialize in solo practice."
- "These open in September, which matches what you mentioned."

**Implementation:** Compare old vs new result sets, identify what constraints changed, generate a human-readable explanation. This is not trivial—it requires understanding the delta between rankings.

### 4. Mapping to Existing Types

The conversation extractor must produce constraints that map to the existing episode model:

```typescript
// src/calibration/schema.ts (existing)
type EnergyState = "settled" | "in-movement" | "low" | "sharp";
type BudgetBand = "under-1k" | "1k-2k" | "2k-3k" | "3k-plus";
type SocialComfort = "solo" | "small-circle" | "open-circle" | "communal";

// src/episodes/model.ts (existing)
type IntentionConstraints = {
  energy?: EnergyState;
  budget?: BudgetBand;
  social?: SocialComfort;
  horizon?: string;  // e.g., "2026-10"
  partySize?: number;
};
```

**Examples:**
- "Too expensive" → `{ budget: "under-1k" }` or `{ budget: "1k-2k" }` (context-dependent)
- "I need something shorter" → `{ horizon: "2026-09", partySize: 1 }` (if duration < 5 days)
- "I want to go alone" → `{ social: "solo" }`
- "What about September?" → `{ horizon: "2026-09" }`

### 5. Commitment Bridge: `retreat.id` → Attestation

The existing booking flow operates on episode-level concepts (holds, attestations, escrow). It does not take a `retreatId` directly. Track A must bridge:

```typescript
// Retreat has optional attestationId
interface Retreat {
  id: string;
  attestationId?: string;  // Links to 0G attestation
  // ...
}

// When user commits:
onCommit(retreatId: string) {
  const retreat = catalog.get(retreatId);
  if (retreat.attestationId) {
    // Bridge to existing hold flow:
    // act({ type: "create-hold", retreatId: retreat.attestationId })
  } else {
    // Handle retreats without attestations (mock data, real operators without 0G)
  }
}
```

**Deliverable:** Track A documents the mapping from `Retreat.id` → `attestationId` → episode hold machinery in Phase A3.

### 6. Extraction Failure Modes

When the keyword parser cannot handle a user message, Track A must return a graceful fallback:

**Options:**
1. Return same retreats with clarifying `miraNote`: "Tell me more about what feels right or wrong about these."
2. Surface a gentle error: "I'm not sure I understood. Try something like 'too expensive' or 'I need more time alone'."
3. Log the failure for later LLM extraction integration.

**Person B needs to know:** Design for `state: "error"` with a `miraNote` that guides the user back to understandable reactions.

### 7. Intermediate Loading State

The showcase scenario assumes instant extraction. In practice:
- Keyword extraction is fast (< 50ms)
- Re-ranking has latency (episode service call, ranking policy re-run)
- Network round-trip adds delay

**Solution:** Track A returns an intermediate `state: "extracting"` immediately when `onUserMessage` is called. Person B can show a subtle loading indicator (Mira's orb pulses, or a "thinking" animation) while the new retreats are computed.

**WebGPU Reference:** The WebGPU pattern uses a `mutating` lock to prevent concurrent transitions. We need an equivalent: `state: "transitioning"` prevents new messages until the motion completes.

---

## Handoff Points

| Time | Handoff | From | To |
|---|---|---|---|
| Day 1 | `Retreat` interface + `mock-catalog.json` (5 stunning retreats) | Track A | Track B |
| Day 5 | Live endpoint/hook: `onUserMessage(text)` returns re-ranked retreats | Track A | Track B |
| Day 8 | Commitment wiring: retreat ID → existing booking flow | Track A | Track B |
| Day 10 | Final integration + polish | Both | Demo |

---

## Reference Patterns

### 1. Sticky Grid Scroll (Desktop)

**Source:** [Codrops - Sticky Grid Scroll](https://tympanus.net/codrops/?p=106424)  
**Repository:** [theoplawinski/codrops-sticky-grid-scroll](https://github.com/theoplawinski/codrops-sticky-grid-scroll)

**Pattern:** A fixed, sticky viewport where scroll advances time, not position. Content reveals progressively through distinct phases orchestrated by GSAP ScrollTrigger + Lenis smooth scrolling.

**Key Technical Elements:**
- `position: sticky` wrapper creates fixed scene
- Scroll height (425vh) creates temporal space for animation
- GSAP timeline orchestrates phases:
  - 0-45%: Grid enters (column reveal)
  - 45-90%: Grid expands (zoom + offsets)
  - 90-95%: Content settles (text/button appear)
- Lenis smooth scrolling synchronized with GSAP ScrollTrigger
- Grid items grouped into columns for staggered reveals

**Ardum Application:**
- Desktop: Each retreat sticks to viewport while Mira's commentary animates alongside
- Scroll position feeds Mira's state (time spent on retreat, details hovered)
- Phases:
  - 0-30%: First retreat enters (hero image reveal)
  - 30-60%: Details expand (dates, price, operator bio)
  - 60-90%: Mira's note appears ("This one has space for solitude")
  - 90-100%: Conversation prompt emerges
- Mobile: Vertical stack with interspersed Mira notes (no sticky scroll)

**Why It Works:**
- User controls pace (scroll = exploration)
- Mira guides without interrupting
- Retreat details reveal progressively (not overwhelming)
- Feels like a guided tour, not a form

### 2. Motion Path Transitions

**Source:** [Codrops - Thumbnail Flow Animation with GSAP MotionPath](https://tympanus.net/codrops/?p=116387)  
**Repository:** [Ibaliqbal/codrops-motion-path-transition](https://github.com/Ibaliqbal/codrops-motion-path-transition)

**Pattern:** Thumbnails flow along curved SVG paths rather than linear transitions. A stack of overlapping thumbnails expands into a vertical strip with a featured image, using GSAP's MotionPath plugin with minimal control points.

**Key Technical Elements:**
- MotionPath plugin with 2 control points per thumbnail
- `curviness: 0.45` creates organic curves
- Staggered timing: `stagger: { from: 'start', each: 0.02 }`
- Each thumbnail gets different final Y position, producing larger arcs for distant items
- Featured image fades/scales in while thumbnails travel

**Ardum Application:**
- When user reacts ("too expensive"), current retreats animate along curved paths out
- New retreats emerge from Mira's orb with motion path entrance
- Curved motion feels orchestrated, not mechanical
- Mobile: Simplified paths (shorter arcs, less complexity)
- Desktop: Complex paths with more curvature

**Why It Works:**
- Curved motion feels intentional and guided (Mira is orchestrating)
- Linear transitions feel mechanical and abrupt
- Organic motion reduces cognitive load (user follows the flow)
- Reinforces "Mira is guiding me" rather than "I am navigating"

### 3. R3F Experimental Carousel (Desktop Only)

**Source:** [Codrops - Wavy Infinite Carousels in React Three Fiber](https://tympanus.net/codrops/?p=104645)  
**Repository:** [colindmg/r3f-experimental-carousel](https://github.com/colindmg/r3f-experimental-carousel)

**Pattern:** Infinite carousel with wavy displacement effect using React Three Fiber + GLSL shaders. Scroll velocity drives vertical displacement via sine wave in vertex shader. Curve strength and frequency create organic curvature.

**Key Technical Elements:**
- GLSL vertex shader with `uScrollSpeed`, `uCurveStrength`, `uCurveFrequency` uniforms
- Sine wave displacement: `pos.y += -sin(uv.x * PI) * uScrollSpeed`
- Cosine curve for horizontal displacement: `pos.x += uCurveStrength * cos(worldPosition.y * uCurveFrequency)`
- Infinite scroll via modulo wrapping: `mod(position.y + totalHeight / 2, totalHeight) - totalHeight / 2`
- Lenis smooth scrolling feeds velocity to shader

**Ardum Application:**
- Desktop: 3D carousel of retreats with wavy motion
- Mira rotates carousel based on conversation (user says "show me more" → carousel advances)
- Shader displacement creates organic, breathing motion
- Mobile: Skip R3F, use swipeable DOM cards (performance)

**Why It Works:**
- 3D depth and motion feel premium and experimental
- Wavy displacement feels alive, not static
- Infinite carousel suggests abundance (many retreats available)
- Desktop-only enhancement (progressive enhancement)

### 4. Gradient Slider Background

**Source:** [Codrops - 3D Infinite Carousel with Reactive Background Gradients](https://tympanus.net/codrops/?p=103532)  
**Repository:** [clementgrellier/gradientslider](https://github.com/clementgrellier/gradientslider)

**Pattern:** Canvas-based background with reactive radial gradients extracted from active image. Colors pulled from image palette, smoothly tweened on card change. Two drifting radial blobs create organic color field.

**Key Technical Elements:**
- Color extraction: Draw image to offscreen canvas (48px longest side), grab pixel data
- Palette building: Analyze pixel data for dominant tones
- Canvas rendering: Two radial gradients with GSAP tweened color transitions
- Blur filter: `filter: blur(24px) saturate(1.05)` for soft, dreamlike quality
- Performance: 30fps idle, higher frame rate during transitions

**Ardum Application:**
- Ambient gradient shifts based on active retreat's dominant colors
- Each retreat has its own color palette (extracted from hero image)
- Gradient creates visual harmony between retreat and atmosphere
- Mira's orb presence integrates with gradient (not separate layer)

**Why It Works:**
- Ambient color creates mood without demanding attention
- Color harmony between retreat and background feels cohesive
- Canvas is performant (no DOM layout/paint recalculation)
- Reinforces "this retreat has its own atmosphere"

### 5. WebGPU Page Transitions

**Source:** [Codrops - Page Transitions with WebGPU and Vanilla JS](https://tympanus.net/codrops/?p=116944)  
**Repository:** [bnpne/page-transitions-with-webgpu-vanilla-js](https://github.com/bnpne/page-transitions-with-webgpu-vanilla-js)

**Pattern:** Persistent WebGPU scene with DOM-bound image planes. Transitions detach planes from DOM tracking, tween bounds/opacity/scale, then reattach to destination slots. Planes never created/destroyed, only kept/removed/added.

**Key Technical Elements:**
- Fixed pool of WebGPU image planes bound to DOM slots
- `getBoundingClientRect()` measures slot positions
- During transition: `plane.trackedEl = null` (detach from DOM, hand bounds to tweens)
- Three roles:
  - **Keep:** Tween bounds from old rect to new rect (shared images)
  - **Remove:** Fade opacity to 0 (leaving images)
  - **Add:** Stamp at target rect, fade opacity 0→1 (new images)
- `tweenBounds()` and `tweenOpacity()` build all transitions
- Both pages coexist during transition (old fades out, new fades in)

**Ardum Application:**
- When user commits to a retreat, transition to booking flow with GPU-accelerated effect
- Retreat hero image morphs into booking confirmation visual
- Progressive enhancement: CSS transition fallback if WebGPU unavailable
- Mobile: Skip WebGPU, use CSS transitions

**Why It Works:**
- GPU-accelerated transitions feel premium and smooth
- Persistent scene eliminates "popping" (browser state swap)
- Morph effect reinforces continuity (same retreat, now booked)
- Progressive enhancement (works without WebGPU)

---

## Implementation Architecture

### Track A: Intelligence & State

**Owner:** Person A
**Goal:** Make Mira instantly understand reactions like "too expensive" and return a newly ranked array of retreats.

#### Phase A1: Retreat Data Layer (Days 1–2)

**Deliverables:**
1. `src/inventory/retreat.ts` — Retreat schema (see Shared Contract)
2. `src/inventory/catalog.ts` — Curated retreat catalog with 5–10 stunning retreats
3. `public/retreats/` — Hero images and gallery assets (WebP, responsive sizes)
4. `src/inventory/color-extraction.ts` — Palette extraction from hero images

**Integration:**
- Wire to existing `AttestationIndex` schema in `src/attestation/schema.ts`
- Map attestation fields to retreat presentation schema
- Use deterministic ranking policy (`src/agent/score.ts`) for initial recommendations
- Deliver `mock-catalog.json` to Track B by end of Day 1

#### Phase A2: Conversation Extraction (Days 3–5)

**Deliverables:**
1. `src/agent/conversation-extractor.ts` — Parse reactions for constraints
2. `src/agent/constraint-updater.ts` — Update episode constraints safely
3. `src/agent/retreat-response.ts` — Re-rank retreats based on extracted constraints

**Examples:**
- "Too expensive" → `{ budget: "under-1k" }`
- "I need something shorter" → `{ duration: { max: 5 } }`
- "I want to go alone" → `{ social: "solo" }`
- "What about September?" → `{ dates: { start: "2026-09-01" } }`

**Approach:**
- Start with keyword/rules for the demo
- Leave a clean interface for swapping in LLM extraction later
- All extractions must produce valid `IntentionConstraints` for the existing episode model

#### Phase A3: Episode Service Wiring (Days 6–7)

**Deliverables:**
1. Update `src/episodes/EpisodeWorkbench.tsx` to render `RetreatExplorationView` instead of `DecisionSlide`
2. Remove `EnergyChoice`, `BudgetChoice`, `SocialChoice`, and `DecisionSlide`
3. Wire `onUserMessage` to episode service via `act({ type: "revise-intention", constraints: {...} })`
4. Ensure commitment flow receives the correct retreat ID

**Integration:**
- Preserve deterministic ranking policy
- Preserve episode state machine
- Preserve existing commitment ceremony

#### Phase A4: Real Operator Data (Days 8–10)

**Deliverables:**
- Replace seed retreats with real operator data
- Real prices, dates, availability
- Operator bios and attestation links

---

### Track B: Motion & Atmosphere

**Owner:** Person B
**Goal:** Make the items fluidly enter, leave, and morph without ever feeling like a standard DOM update.

#### Phase B1: Core Presentation & Ambient Gradient (Days 1–3)

**Deliverables:**
1. `src/components/RetreatExplorationView.tsx` — Main presentation component
2. `src/components/RetreatCard.tsx` — Individual retreat card
3. `src/components/MiraNote.tsx` — Mira's contextual commentary
4. `src/components/AmbientGradient.tsx` — Reactive canvas background

**Inputs from Track A:**
- `Retreat` interface (Day 1)
- `mock-catalog.json` (Day 1)

**Output to Track A:**
- Stable React component with props: `retreats`, `miraNote`, `onUserMessage`, `onCommit`

#### Phase B2: Sticky Scroll & R3F Carousel (Days 4–6)

**Deliverables:**
1. `src/components/StickyRetreatGrid.tsx` — Desktop sticky scroll
2. `src/hooks/useScrollTimeline.ts` — Scroll-driven animation hook
3. `src/components/RetreatCarousel.tsx` — Desktop R3F wavy carousel
4. `src/shaders/retreat-carousel.glsl` — GLSL shaders

**Mobile:**
- Vertical stack with interspersed notes
- Swipeable DOM cards

#### Phase B3: Motion Path Transitions (Days 7–8)

**Deliverables:**
1. `src/components/MotionPathTransition.tsx` — Curved path animations
2. `src/hooks/useMotionPath.ts` — Motion path hook

**Behavior:**
- Old retreats arc off-screen toward Mira's orb
- New retreats emerge from Mira's orb and arc into grid positions
- Staggered timing with organic curves

#### Phase B4: WebGPU Commitment Transition (Days 9–10)

**Deliverables:**
1. `src/components/WebGPUTransition.tsx` — GPU-accelerated transition
2. `src/utils/webgpu-scene.ts` — WebGPU scene management

**Behavior:**
- On commit, retreat hero image morphs into booking confirmation
- CSS fallback for mobile / unsupported browsers

---

## Cross-Track Integration Schedule

| Day | Track A | Track B | Integration |
|---|---|---|---|
| 1 | Finalize `Retreat` schema; deliver `mock-catalog.json` | Set up component scaffold; AmbientGradient | Agree on props contract |
| 2 | Build catalog service; wire ranking | Build RetreatCard; MiraNote | Visual review |
| 3 | Color extraction service | Core layout responsive stack | Merge branch A1 + B1 |
| 4 | Conversation extraction (keyword rules) | Sticky scroll prototype | Handoff: extraction hook |
| 5 | Live ranking hook `onUserMessage` | R3F carousel prototype | Connect real data to UI |
| 6 | Constraint updater | Sticky scroll polish | End-to-end reaction flow |
| 7 | Episode wiring | Motion path transitions | Old/new retreat swap |
| 8 | Real operator data integration | WebGPU transition prototype | Commitment wiring |
| 9 | Latency tuning; extraction edge cases | WebGPU polish; mobile fallback | Performance pass |
| 10 | Final data validation | Final motion polish | Demo rehearsal |

---

## Component Architecture

### Removed Components

- `src/components/MiraChoices.tsx` (EnergyChoice, BudgetChoice, SocialChoice)
- `src/components/DecisionSlide.tsx`
- The "the next decision" tag

### Added Components

```
src/
  inventory/
    retreat.ts              # Retreat schema
    catalog.ts              # Curated retreat catalog
    color-extraction.ts     # Palette extraction from images
  
  components/
    RetreatExplorationView.tsx   # Main presentation component
    RetreatCard.tsx              # Individual retreat card
    MiraNote.tsx                 # Mira's contextual commentary
    StickyRetreatGrid.tsx        # Sticky scroll (desktop)
    RetreatCarousel.tsx          # 3D carousel (desktop, R3F)
    RetreatConversationOverlay.tsx # Chat-style input
    MotionPathTransition.tsx     # Curved path animations
    AmbientGradient.tsx          # Reactive background gradient
    WebGPUTransition.tsx         # GPU-accelerated commitment transition
  
  hooks/
    useScrollTimeline.ts         # Scroll-driven animation
    useMotionPath.ts             # Motion path transitions
  
  agent/
    conversation-extractor.ts    # Parse reactions for constraints
    conversation-parser.ts     # Natural language parser
    constraint-updater.ts      # Update episode constraints
    retreat-response.ts          # Generate new retreats
  
  shaders/
    retreat-carousel.glsl        # GLSL shaders for R3F carousel
  
  utils/
    webgpu-scene.ts              # WebGPU scene management

public/
  retreats/                      # Hero images and gallery assets
    retreat-001/
      hero.webp
      gallery-1.webp
      gallery-2.webp
    retreat-002/
      ...
```

---

## User Journey Flow

### Arrival (Unchanged)

```
User lands on /
  ↓
Aesthetic calibration (4 image reactions)
  ↓
Retreat vision (curated frame from catalog)
  ↓
Intention input: "What are you trying to make space for?"
  ↓
User types: "I need a quiet week before October"
  ↓
Commit intention → episode created
  ↓
Route change to /episode/{id}
```

### Episode Exploration (New)

```
Episode page loads
  ↓
Show 3 retreats from ranking service (default constraints)
  ↓
Desktop: Sticky scroll + carousel
Mobile: Vertical stack with notes
  ↓
User scrolls through retreats
  ↓
Mira's notes animate in alongside each retreat
  ↓
User reacts: "That first one looks too expensive"
  ↓
Motion path transition: old retreats animate out
  ↓
New retreats emerge from Mira's orb
  ↓
User: "The second one is perfect. Is it still available?"
  ↓
Mira: "Yes, I can place a non-binding hold for 48 hours."
  ↓
User: "Yes, hold it."
  ↓
WebGPU transition to booking flow
  ↓
Commitment ceremony (identity, deposit, confirmation)
```

### Key Differences

**Current (quiz):**
- User introspects into abstract categories
- Three consecutive question screens
- Feels like a form

**New (exploration):**
- User reacts to real retreats
- One continuous exploration with conversation
- Feels like a guided tour

---

## The Showcase Moment

**The setup:** You are screen-sharing with a retreat partner.

1. **The Hook:** A user types, *"I need a quiet week in October."* Instead of a loading spinner or a questionnaire, **three striking retreats instantly glide in on curved paths**, hovering over a canvas background that smoothly shifts to match their sunset colors.

2. **The Flex (Agentic sorting):** The user types, *"That first one is too expensive."* Mira instantly extracts the budget constraint. The expensive retreat organically arcs off-screen, while a more affordable option swoops out from Mira's orb to fill the gap. No page reloads.

3. **The Reactivator (Commitment):** The user says, *"Let's hold the second one."* They click to confirm. The WebGPU transition fires: the 2D UI detaches, the retreat's hero image morphs and elevates, scaling up smoothly into a glossy, receipt-like booking confirmation.

It proves to partners: *Ardum treats your inventory like high-end art, and handles the logic flawlessly.*

---

## Performance Strategy

### Mobile-First

- Sticky scroll + motion paths work everywhere
- R3F carousel is desktop-only enhancement
- WebGPU is progressive enhancement (CSS fallback)
- Image optimization: Next.js Image with proper sizing

### Bundle Size

- R3F and WebGPU patterns are code-split
- Core experience works without them
- Lazy-load below-fold retreat images
- Canvas gradient background is lightweight

### Rendering

- `will-change: transform` on animated elements
- `contain: layout paint` to limit render scope
- Canvas gradient: 30fps idle, higher during transitions
- GSAP + Lenis smooth scrolling synchronized

---

## Strategic Differentiation

### What ChatGPT Can't Do

1. **Proprietary supply:** Real retreat operators with real availability
2. **Domain-specific ranking:** Deterministic policy tuned for yoga retreats
3. **Transaction infrastructure:** Holds, bookings, coordination, on-chain settlement
4. **Curated inventory:** Vetted, specific retreats (not hallucinated)

### The 30-Second Signal

When a user lands on Ardum:
- **ChatGPT:** "What are you looking for?" → generic answer
- **Ardum:** Shows real retreats immediately → specificity, proprietary supply, domain expertise

### The Wedge

Inventory-led experience creates a wedge that general-purpose LLMs cannot cross:
- They don't have real retreat inventory
- They don't have domain-specific ranking
- They don't have transaction infrastructure
- They can't show real retreats in the first 30 seconds

---

## Success Metrics

### Cognitive Load Reduction

- Time from intention to first retreat shown: < 5 seconds
- Number of user interactions before seeing retreats: 1 (intention input)
- User-reported cognitive load: Lower than quiz pattern

### Engagement

- Time spent exploring retreats: Higher than quiz completion time
- Number of retreats viewed per session: Higher than quiz completion rate
- Conversation depth: More natural reactions, fewer abstract answers

### Conversion

- Time from intention to hold: Shorter (user reacts to real things)
- Hold-to-booking rate: Higher (user has seen real retreats)
- User confidence: Higher (specificity builds trust)

---

## Next Steps

1. **Agree on the shared contract** (Day 1)
   - `Retreat` interface
   - Props contract for `RetreatExplorationView`
   - Handoff schedule

2. **Split into two parallel tracks** (Day 1)
   - Person A: Intelligence & State
   - Person B: Motion & Atmosphere

3. **Build the showcase** (Days 2–9)
   - Track A: catalog, extraction, ranking, wiring
   - Track B: presentation, motion, transitions, atmosphere

4. **Demo and iterate** (Day 10)
   - Rehearse the showcase moment
   - Tune latency and polish motion
   - Present to retreat partners

## References

- [Codrops - Sticky Grid Scroll](https://tympanus.net/codrops/?p=106424)
- [Codrops - Motion Path Transition](https://tympanus.net/codrops/?p=116387)
- [Codrops - R3F Experimental Carousel](https://tympanus.net/codrops/?p=104645)
- [Codrops - Gradient Slider](https://tympanus.net/codrops/?p=103532)
- [Codrops - WebGPU Page Transitions](https://tympanus.net/codrops/?p=116944)
- [Peter Thiel - Zero to One](https://www.peterthiel.com/zero-to-one/)
- [Paul Graham - Do Things That Don't Scale](http://paulgraham.com/ds.html)
