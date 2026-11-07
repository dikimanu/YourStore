import { describe, it, expect } from "vitest";
import { imageUrl } from "../src/imageUrl.js";

describe("imageUrl helper", () => {
  it("formats thumb preset at 200w with f_auto,q_auto,c_limit", () => {
    const url = imageUrl("products/sample-item", "thumb", "testcloud");
    expect(url).toBe(
      "https://res.cloudinary.com/testcloud/image/upload/f_auto,q_auto,c_limit,w_200/products/sample-item",
    );
  });

  it("formats card preset at 400w with f_auto,q_auto,c_limit", () => {
    const url = imageUrl("products/sample-item", "card", "testcloud");
    expect(url).toBe(
      "https://res.cloudinary.com/testcloud/image/upload/f_auto,q_auto,c_limit,w_400/products/sample-item",
    );
  });

  it("formats detail preset at 800w with f_auto,q_auto,c_limit", () => {
    const url = imageUrl("products/sample-item", "detail", "testcloud");
    expect(url).toBe(
      "https://res.cloudinary.com/testcloud/image/upload/f_auto,q_auto,c_limit,w_800/products/sample-item",
    );
  });

  it("formats zoom preset at 1400w with f_auto,q_auto,c_limit", () => {
    const url = imageUrl("products/sample-item", "zoom", "testcloud");
    expect(url).toBe(
      "https://res.cloudinary.com/testcloud/image/upload/f_auto,q_auto,c_limit,w_1400/products/sample-item",
    );
  });

  it("returns full external URLs directly without re-encoding", () => {
    const external = "https://images.unsplash.com/photo-12345";
    const url = imageUrl(external, "card", "testcloud");
    expect(url).toBe(external);
  });
});
