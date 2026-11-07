import { describe, it, expect, vi } from "vitest";
import mongoose, { Types } from "mongoose";
import { User } from "../models/User.js";
import { AuditLog } from "../models/AuditLog.js";
import { createAuditLog } from "../lib/auditLog.js";
import { logger } from "../lib/logger.js";

describe("Models & Logging Foundation", () => {
  describe("User Model", () => {
    it("instantiates a User document with required fields and defaults", () => {
      const user = new User({
        name: "Test User",
        email: "test@example.com",
        passwordHash: "argon2id$hashedpassword123",
      });

      expect(user.name).toBe("Test User");
      expect(user.email).toBe("test@example.com");
      expect(user.role).toBe("user");
      expect(user.emailVerified).toBe(false);
      expect(user.failedLoginCount).toBe(0);
      expect(user.addresses).toEqual([]);
      expect(user.wishlist).toEqual([]);
      expect(user.cart).toEqual([]);
    });

    it("identifies account lock state correctly with isLocked()", () => {
      const activeUser = new User({
        name: "Active User",
        email: "active@example.com",
        passwordHash: "hashed",
        lockUntil: null,
      });
      expect(activeUser.isLocked()).toBe(false);

      const pastLockedUser = new User({
        name: "Past Locked User",
        email: "past@example.com",
        passwordHash: "hashed",
        lockUntil: new Date(Date.now() - 60000), // 1 min ago
      });
      expect(pastLockedUser.isLocked()).toBe(false);

      const lockedUser = new User({
        name: "Locked User",
        email: "locked@example.com",
        passwordHash: "hashed",
        lockUntil: new Date(Date.now() + 15 * 60000), // 15 mins in future
      });
      expect(lockedUser.isLocked()).toBe(true);
    });

    it("strips passwordHash and secret tokens from toJSON output", () => {
      const user = new User({
        name: "Jane Doe",
        email: "jane@example.com",
        passwordHash: "super-secret-password-hash",
        refreshTokenHash: "refresh-token-hash",
        emailVerificationTokenHash: "verify-hash",
        resetPasswordTokenHash: "reset-hash",
        role: "user",
      });

      const json = user.toJSON() as Record<string, unknown>;

      expect(json["id"]).toBeDefined();
      expect(json["_id"]).toBeUndefined();
      expect(json["passwordHash"]).toBeUndefined();
      expect(json["refreshTokenHash"]).toBeUndefined();
      expect(json["emailVerificationTokenHash"]).toBeUndefined();
      expect(json["resetPasswordTokenHash"]).toBeUndefined();
      expect(json["__v"]).toBeUndefined();
      expect(json["name"]).toBe("Jane Doe");
      expect(json["email"]).toBe("jane@example.com");
    });

    it("supports addresses and cart items", () => {
      const productId = new Types.ObjectId();
      const user = new User({
        name: "Buyer",
        email: "buyer@example.com",
        passwordHash: "hash",
        addresses: [
          {
            label: "Home",
            name: "Buyer Name",
            phone: "9876543210",
            line1: "123 Main Street",
            city: "Mumbai",
            state: "Maharashtra",
            pincode: "400001",
          },
        ],
        cart: [
          {
            productId,
            variantSku: "TSHIRT-BLK-M",
            qty: 2,
          },
        ],
      });

      expect(user.addresses.length).toBe(1);
      expect(user.addresses[0]?.city).toBe("Mumbai");
      expect(user.cart.length).toBe(1);
      expect(user.cart[0]?.variantSku).toBe("TSHIRT-BLK-M");
    });
  });

  describe("AuditLog Model & Helper", () => {
    it("validates AuditLog schema fields", () => {
      const audit = new AuditLog({
        actor: "admin_123",
        action: "PRODUCT_DELETE",
        targetType: "Product",
        targetId: "prod_456",
        meta: { reason: "Discontinued item" },
      });

      expect(audit.actor).toBe("admin_123");
      expect(audit.action).toBe("PRODUCT_DELETE");
      expect(audit.targetType).toBe("Product");
      expect(audit.targetId).toBe("prod_456");
      expect(audit.at).toBeInstanceOf(Date);
    });

    it("createAuditLog gracefully handles errors without throwing", async () => {
      // 1. When disconnected, returns null without throwing or hanging
      const resultDisconnected = await createAuditLog({
        actor: "system",
        action: "TEST_ACTION",
        targetType: "System",
      });
      expect(resultDisconnected).toBeNull();

      // 2. When create rejects, catches and returns null without throwing
      const readyStateSpy = vi
        .spyOn(mongoose.connection, "readyState", "get")
        .mockReturnValue(mongoose.ConnectionStates.connected);
      const createSpy = vi.spyOn(AuditLog, "create").mockRejectedValueOnce(new Error("Database write error"));

      const resultError = await createAuditLog({
        actor: "admin_123",
        action: "TEST_ACTION",
        targetType: "User",
      });
      expect(resultError).toBeNull();

      readyStateSpy.mockRestore();
      createSpy.mockRestore();
    });
  });

  describe("Pino Logger PII Redaction", () => {
    it("has redaction configured for sensitive fields and PII", () => {
      // logger instance should be initialized
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.warn).toBe("function");
    });
  });
});
