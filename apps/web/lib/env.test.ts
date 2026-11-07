import { describe, it, expect } from "vitest";

describe("web app", () => {
  it("environment defaults are sane", () => {
    const apiUrl = process.env["API_URL"] ?? "http://localhost:4000";
    expect(apiUrl).toMatch(/^https?:\/\//);
  });
});
