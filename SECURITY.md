# Security Policy & Architecture

This document describes the security controls, policies, and threat mitigations implemented in **YourStore**, as outlined in `PROJECT_BRIEF.md`.

---

## 1. Authentication & Session Management

- **Password Hashing:**
  - Implemented using **Argon2id** (`argon2.argon2id`) with memory cost of 64 MB, 3 iterations, and parallelism of 1 (`apps/api/src/lib/password.ts`).
  - Passwords must satisfy strength requirements: minimum 8 characters, maximum 100 characters, at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character (`packages/shared/src/schemas.ts`).

- **Tokens & Cookies:**
  - **Access Token:** Short-lived JWT (15 minutes expiry) signed with `JWT_ACCESS_SECRET`.
  - **Refresh Token:** Long-lived JWT (7 days expiry) signed with `JWT_REFRESH_SECRET`, stored in the database only as a **SHA-256 hash** (`apps/api/src/lib/token.ts`).
  - Both tokens are delivered to clients via `httpOnly`, `Secure` (in production), `SameSite=Lax` cookies, preventing client-side JavaScript access and XSS theft.

- **Token Rotation & Reuse Detection:**
  - Every call to `/api/v1/auth/refresh` rotates both the access token and the refresh token (`apps/api/src/controllers/auth.ts`).
  - If a refresh token is presented whose hash does not match the stored hash (e.g. replaying an already-used token), **token reuse detection** triggers: all active refresh sessions for the user are immediately revoked, cookies are cleared, and a security audit log event is recorded.

- **Email Verification & Password Reset:**
  - Single-use, expiring tokens generated with cryptographic randomness (`crypto.randomBytes(32)`).
  - Tokens are stored in the database strictly as **SHA-256 hashes** (`emailVerificationTokenHash`, `resetPasswordTokenHash`) alongside expiration timestamps.
  - Verification tokens expire in 24 hours; reset tokens expire in 1 hour.
  - Single-use guarantee: tokens are immediately set to `null` upon successful use, preventing replay attacks.
  - All existing refresh sessions (`refreshTokenHash`) are revoked when a password reset completes.
  - Timing attack & enumeration defense: `POST /api/v1/auth/forgot-password` returns an identical generic response regardless of whether an account exists.
  - Transactional emails are handled via Resend (`apps/api/src/lib/email.ts`).

- **Account Lockout & Timing Attack Mitigation:**
  - After 5 consecutive failed login attempts, the account is locked for 15 minutes (`apps/api/src/controllers/auth.ts`).
  - Identical error messages (`"Invalid email or password"`) and HTTP status codes (`401 Unauthorized`) are returned for non-existent emails and incorrect passwords, preventing account enumeration.

- **Data Privacy & Schema Filtering:**
  - The `passwordHash`, `refreshTokenHash`, `emailVerificationTokenHash`, and `resetPasswordTokenHash` fields have `select: false` in Mongoose and are stripped by Mongoose's `toJSON` and `toObject` transform hooks (`apps/api/src/models/User.ts`).

---

## 2. API Hardening & Middleware

- **Helmet & Strict Content Security Policy (CSP):**
  - Configured with strict CSP directives (`apps/api/src/middleware/security.ts`):
    - `defaultSrc: ["'self'"]`
    - `scriptSrc: ["'self'"]`
    - `objectSrc: ["'none'"]`
    - `frameAncestors: ["'none'"]`
    - `imgSrc: ["'self'", "data:", "https://res.cloudinary.com"]`

- **Strict CORS:**
  - Configured to only permit requests from the configured `CLIENT_ORIGIN` (`apps/api/src/middleware/security.ts`). Unauthorized origins receive a `403 Forbidden` response.

- **Rate Limiting:**
  - Global API rate limiter allows 100 requests per 15 minutes per IP (`apps/api/src/middleware/rateLimit.ts`).
  - Tighter auth limiter allows 10 requests per 15 minutes per IP on `/api/v1/auth/*` routes to prevent credential stuffing and brute-force attacks.
  - Returns standard consistent error response `{ error: { code: "RATE_LIMIT_EXCEEDED", message: ... } }`.

- **NoSQL Injection Defense:**
  - `express-mongo-sanitize` middleware strips keys starting with `$` or containing `.` from request bodies, query strings, and route parameters (`apps/api/src/middleware/security.ts`).

- **CSRF Protection:**
  - State-changing HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`) require a custom header (`X-Requested-With` or `X-CSRF-Token`). Browsers cannot attach custom headers cross-origin without CORS preflight authorization (`apps/api/src/middleware/csrf.ts`).

- **Payload Size Limits:**
  - Express JSON and URL-encoded body parsers are restricted to `10mb` max body size (`apps/api/src/index.ts`).

- **Zod Request Validation:**
  - All request parameters, query strings, and request bodies are validated using shared Zod schemas (`apps/api/src/middleware/validate.ts`).
  - Validation failures return structured 400 Bad Request responses with field-level issues.

---

## 3. Role-Based Access Control (RBAC)

- `authenticate` middleware verifies the access token from cookies or `Authorization: Bearer <token>` header (`apps/api/src/middleware/auth.ts`).
- `requireRole(...roles)` validates that the authenticated user possesses the required role (e.g. `admin`), returning `403 Forbidden` if unauthorized.

---

## 4. Logging & Auditing

- **Pino Logger with PII Redaction:**
  - Configured with automated redaction paths for passwords, hashes, tokens, emails, phone numbers, credit card numbers, authorization headers, and cookies (`apps/api/src/lib/logger.ts`).
- **Audit Logging:**
  - Administrative and security-sensitive events (such as account lockout and token reuse detection) are tracked in the `AuditLog` collection with actor, action, target, metadata, and timestamp (`apps/api/src/models/AuditLog.ts`, `apps/api/src/lib/auditLog.ts`).
