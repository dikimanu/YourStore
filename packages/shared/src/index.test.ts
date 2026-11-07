import { describe, it, expect } from "vitest";
import { CATEGORIES, ORDER_STATUSES, IMAGE_PRESETS } from "../src/index.js";

describe("shared constants", () => {
  it("exports expected categories", () => {
    expect(CATEGORIES).toContain("gadgets");
    expect(CATEGORIES).toContain("clothing");
    expect(CATEGORIES).toContain("electronics");
    expect(CATEGORIES).toContain("vehicles");
    expect(CATEGORIES).toContain("home");
  });

  it("exports order statuses", () => {
    expect(ORDER_STATUSES).toContain("Placed");
    expect(ORDER_STATUSES).toContain("Delivered");
  });

  it("exports image presets", () => {
    expect(IMAGE_PRESETS).toContain("thumb");
    expect(IMAGE_PRESETS).toContain("zoom");
  });
});
