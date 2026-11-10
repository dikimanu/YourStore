import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  ORDER_STATUSES,
  IMAGE_PRESETS,
  RegisterInputSchema,
  LoginInputSchema,
  ResetPasswordInputSchema,
  ForgotPasswordInputSchema,
  VerifyEmailInputSchema,
} from "../src/index.js";

describe("shared constants", () => {
  it("exports expected categories", () => {
    expect(CATEGORIES).toContain("gadgets");
    expect(CATEGORIES).toContain("clothing");
    expect(CATEGORIES).toContain("electronics");
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

describe("auth schemas", () => {
  it("validates valid registration input and normalizes email", () => {
    const input = {
      name: "John Doe",
      email: "  John.Doe@Example.com  ",
      password: "Password123!",
    };
    const parsed = RegisterInputSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("john.doe@example.com");
    }
  });

  it("rejects weak passwords for registration", () => {
    const weakPasswords = [
      "short1!", // too short (< 8)
      "passwordwithoutupper1!", // missing uppercase
      "PASSWORDWITHOUTLOWER1!", // missing lowercase
      "PasswordWithoutNumber!", // missing number
      "Password123456", // missing special character
    ];

    for (const pwd of weakPasswords) {
      const res = RegisterInputSchema.safeParse({
        name: "Test User",
        email: "test@example.com",
        password: pwd,
      });
      expect(res.success).toBe(false);
    }
  });

  it("validates login input", () => {
    const valid = LoginInputSchema.safeParse({
      email: "User@Domain.Com",
      password: "anypassword",
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.email).toBe("user@domain.com");
    }

    const invalid = LoginInputSchema.safeParse({
      email: "not-an-email",
      password: "",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates forgot and reset password inputs", () => {
    const forgotValid = ForgotPasswordInputSchema.safeParse({ email: "test@example.com" });
    expect(forgotValid.success).toBe(true);

    const resetValid = ResetPasswordInputSchema.safeParse({
      token: "valid-token-123",
      password: "StrongPassword1@",
    });
    expect(resetValid.success).toBe(true);

    const resetInvalid = ResetPasswordInputSchema.safeParse({
      token: "",
      password: "weak",
    });
    expect(resetInvalid.success).toBe(false);

    const verifyValid = VerifyEmailInputSchema.safeParse({ token: "verify-token" });
    expect(verifyValid.success).toBe(true);
  });
});
