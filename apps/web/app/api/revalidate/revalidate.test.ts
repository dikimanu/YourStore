import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route.js";

// Mock next/cache revalidatePath
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("POST /api/revalidate", () => {
  const SECRET = "test_revalidate_secret_12345";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env["REVALIDATE_SECRET"] = SECRET;
  });

  it("rejects requests missing the x-revalidate-secret header", async () => {
    const req = new NextRequest("http://localhost:3000/api/revalidate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ paths: ["/"] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects requests with an incorrect secret", async () => {
    const req = new NextRequest("http://localhost:3000/api/revalidate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": "wrong_secret_value",
      },
      body: JSON.stringify({ paths: ["/"] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("successfully revalidates requested paths with correct secret", async () => {
    const req = new NextRequest("http://localhost:3000/api/revalidate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": SECRET,
      },
      body: JSON.stringify({ paths: ["/", "/product/test-slug", "/category/gadgets"] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      revalidated: boolean;
      paths: string[];
    };
    expect(body.revalidated).toBe(true);
    expect(body.paths).toEqual(["/", "/product/test-slug", "/category/gadgets"]);
  });
});
