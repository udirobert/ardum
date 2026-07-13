import { describe, expect, it } from "vitest";
import { NEUTRAL_VECTOR } from "@/aesthetics/image-pool";
import { POST } from "./route";

describe("POST /api/aesthetics/vision", () => {
  it("returns deterministic curated vision", async () => {
    const response = await POST(
      new Request("http://localhost/api/aesthetics/vision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vector: NEUTRAL_VECTOR }),
      }),
    );
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.source).toBe("curated");
    expect(data.imageUrl).toMatch(/^\/aesthetics\/visions\/.+\.jpg$/);
    expect(data.prompt).toContain("Cinematic retreat vision");
    expect(data.fingerprint).toBeTruthy();
    expect(data.grade).toMatchObject({
      warmth: expect.any(Number),
      darkness: expect.any(Number),
      calm: expect.any(Number),
    });
  });

  it("uses calibration interactions when provided", async () => {
    const response = await POST(
      new Request("http://localhost/api/aesthetics/vision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vector: NEUTRAL_VECTOR,
          interactions: [{ imageId: "temple-stone", reaction: "resonate" }],
        }),
      }),
    );
    const data = await response.json();
    expect(data.imageId).toBe("temple-stone");
  });
});
