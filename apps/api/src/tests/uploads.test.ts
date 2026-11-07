import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { User, IUser } from "../models/User.js";
import { generateAccessToken } from "../lib/token.js";

// Ensure environment variables are loaded
process.env["JWT_ACCESS_SECRET"] = "test_jwt_access_secret_32chars_long!";
process.env["JWT_REFRESH_SECRET"] = "test_jwt_refresh_secret_32chars_long";
process.env["CLIENT_ORIGIN"] = "http://localhost:3000";
process.env["CLOUDINARY_CLOUD_NAME"] = "test_cloud_name";
process.env["CLOUDINARY_API_KEY"] = "123456789012345";
process.env["CLOUDINARY_API_SECRET"] = "test_cloudinary_api_secret_sample";
process.env["VITEST"] = "true";

const { app } = await import("../index.js");

const idToString = (v: string | Types.ObjectId): string =>
  typeof v === "string" ? v : v.toHexString();

describe("Phase 2 Part B-i: Admin Upload Signing", () => {
  const memoryUsers = new Map<string, IUser>();

  let adminToken: string;
  let userToken: string;

  beforeEach(() => {
    memoryUsers.clear();
    vi.restoreAllMocks();

    vi.spyOn(User, "findById").mockImplementation((id: unknown) => {
      const user = id ? memoryUsers.get(idToString(id as string | Types.ObjectId)) : null;
      return {
        select: vi.fn().mockImplementation(() => Promise.resolve(user ?? null)),
        then: (resolve: (val: unknown) => void) => Promise.resolve(user ?? null).then(resolve),
      } as unknown as ReturnType<typeof User.findById>;
    });

    const adminId = new Types.ObjectId().toString();
    const adminUser = {
      _id: adminId,
      name: "Admin User",
      email: "admin@yourstore.in",
      role: "admin",
      emailVerified: true,
      failedLoginCount: 0,
      isLocked: () => false,
      toObject: () => ({ _id: adminId, role: "admin", name: "Admin User", email: "admin@yourstore.in" }),
    } as unknown as IUser;
    memoryUsers.set(adminId, adminUser);
    adminToken = generateAccessToken({
      sub: adminId,
      role: "admin",
      email: "admin@yourstore.in",
    });

    const regularUserId = new Types.ObjectId().toString();
    const regularUser = {
      _id: regularUserId,
      name: "Customer User",
      email: "customer@yourstore.in",
      role: "user",
      emailVerified: true,
      failedLoginCount: 0,
      isLocked: () => false,
      toObject: () => ({ _id: regularUserId, role: "user", name: "Customer User", email: "customer@yourstore.in" }),
    } as unknown as IUser;
    memoryUsers.set(regularUserId, regularUser);
    userToken = generateAccessToken({
      sub: regularUserId,
      role: "user",
      email: "customer@yourstore.in",
    });
  });

  it("rejects unsigned requests with 401 Unauthorized", async () => {
    const res = await request(app)
      .post("/api/v1/admin/uploads/sign")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        fileType: "image/jpeg",
        fileSize: 1024 * 1024,
        imageCount: 1,
      });

    expect(res.status).toBe(401);
  });


  it("rejects non-admin users with 403 Forbidden", async () => {
    const res = await request(app)
      .post("/api/v1/admin/uploads/sign")
      .set("Authorization", `Bearer ${userToken}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        fileType: "image/jpeg",
        fileSize: 1024 * 1024,
        imageCount: 1,
      });

    expect(res.status).toBe(403);
    const body = res.body as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("rejects invalid file type with 400 Bad Request", async () => {
    const res = await request(app)
      .post("/api/v1/admin/uploads/sign")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        fileType: "application/pdf",
        fileSize: 1024 * 1024,
        imageCount: 1,
      });

    expect(res.status).toBe(400);
    const body = res.body as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects file sizes exceeding 10 MB with 400 Bad Request", async () => {
    const res = await request(app)
      .post("/api/v1/admin/uploads/sign")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        fileType: "image/png",
        fileSize: 10 * 1024 * 1024 + 1, // 10MB + 1 byte
        imageCount: 1,
      });

    expect(res.status).toBe(400);
    const body = res.body as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects image count greater than 6 with 400 Bad Request", async () => {
    const res = await request(app)
      .post("/api/v1/admin/uploads/sign")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        fileType: "image/webp",
        fileSize: 2 * 1024 * 1024,
        imageCount: 7,
      });

    expect(res.status).toBe(400);
    const body = res.body as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("allows admin with valid inputs and returns upload signature and credentials", async () => {
    const res = await request(app)
      .post("/api/v1/admin/uploads/sign")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        fileType: "image/jpeg",
        fileSize: 1.5 * 1024 * 1024,
        imageCount: 3,
      });

    expect(res.status).toBe(200);
    const body = res.body as {
      signature: string;
      timestamp: number;
      apiKey: string;
      cloudName: string;
      folder: string;
    };

    expect(typeof body.signature).toBe("string");
    expect(body.signature.length).toBe(40); // SHA-1 hex
    expect(typeof body.timestamp).toBe("number");
    expect(body.apiKey).toBe("123456789012345");
    expect(body.cloudName).toBe("test_cloud_name");
    expect(body.folder).toBe("yourstore/products");
    // Ensure API secret is NOT present in the response
    expect((body as Record<string, unknown>)["apiSecret"]).toBeUndefined();
  });
});
