// Loaded once before any vitest test file in this repo. We mock the
// "server-only" package to an empty stub so vitest can import modules
// marked server-only (e.g. src/episodes/repositories/supabase.ts, which
// `import "server-only"`) without tripping Next.js' client-boundary
// guard. The marker has no runtime semantics vitest needs; production
// server code paths still see the real package and the build still
// enforces the boundary.
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
