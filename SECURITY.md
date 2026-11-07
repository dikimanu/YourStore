# Security Policy & Architecture

This document details the security model, defenses against specific threats covered in **Phase 1** of `PROJECT_BRIEF.md`, their exact implementation locations in the codebase, and known limitations.

---

## 1. Threats, Defenses, and Implementation Locations

| Threat / Requirement (Section 8) | Defense & Architecture | Implementation Location |
| :--- | :--- | :--- |
| **Cross-Site Scripting (XSS) & Clickjacking** | Helmet with a strict Content Security Policy (CSP): `defaultSrc: ['self']`, `scriptSrc: ['self']`, `objectSrc: ['none']`, `frameAncestors: ['none']`, `imgSrc: ['self', 'data:', 'https://res.cloudinary.com']`, and `X-Content-Type-Options: nosniff`. | [`apps/api/src/middleware/security.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/middleware/security.ts) |
| **Cross-Origin API Abuse** | Strict CORS policy that restricts cross-origin communication strictly to the configured `CLIENT_ORIGIN` (returns `403 Forbidden` for unauthorized origins). | [`apps/api/src/middleware/security.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/middleware/security.ts) |
| **Denial of Service & Brute Force** | Global rate limiting (100 req / 15 min / IP) and tighter rate limiting on `/api/v1/auth/*` (10 req / 15 min / IP). Exemption for internal/health ping. Returns consistent `429 RATE_LIMIT_EXCEEDED`. | [`apps/api/src/middleware/rateLimit.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/middleware/rateLimit.ts) |
| **NoSQL Injection ($ and . operators)** | `express-mongo-sanitize` middleware strips keys starting with `$` or containing `.` from request bodies, parameters, and query strings. | [`apps/api/src/middleware/security.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/middleware/security.ts) |
| **Input Tampering & Malformed Payloads** | Zod validation middleware validating `body`, `query`, and `params` against shared schemas. Returns consistent `400 VALIDATION_ERROR` with field paths. | [`apps/api/src/middleware/validate.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/middleware/validate.ts)<br>[`packages/shared/src/schemas.ts`](file:///c:/Users/Admin/Downloads/YourStore/packages/shared/src/schemas.ts) |
| **Buffer Overflow / Large Payload DoS** | Enforced 10 MB limit on `express.json()` and `express.urlencoded()`. | [`apps/api/src/index.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/index.ts) |
| **Token Theft via XSS (localStorage risks)** | Access token (15m) and refresh token (7d) are delivered exclusively in `httpOnly`, `Secure` (in production), `SameSite=Lax` cookies. Client code explicitly never touches `localStorage` or `sessionStorage`. | [`apps/api/src/lib/token.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/lib/token.ts)<br>[`apps/web/lib/api.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/web/lib/api.ts) |
| **Token Stolen from Database Dump** | Refresh tokens are stored in MongoDB only as a cryptographic **SHA-256 hash** (`refreshTokenHash`), never as plain text. | [`apps/api/src/lib/token.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/lib/token.ts)<br>[`apps/api/src/models/User.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/models/User.ts) |
| **Refresh Token Replay & Theft (Reuse Detection)** | Token rotation on every refresh request. If a refresh token is presented whose hash does not match `user.refreshTokenHash`, **token reuse detection** revokes all active sessions (`user.refreshTokenHash = null`), clears cookies, logs an audit entry, and rejects with `401 Unauthorized`. | [`apps/api/src/controllers/auth.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/controllers/auth.ts) |
| **Cross-Site Request Forgery (CSRF)** | Custom header enforcement (`X-Requested-With` or `X-CSRF-Token`) on all state-changing HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`). External webhooks are exempted. Web client automatically injects `X-Requested-With`. | [`apps/api/src/middleware/csrf.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/middleware/csrf.ts)<br>[`apps/web/lib/api.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/web/lib/api.ts) |
| **Credential Stuffing & Brute-Force Password Guessing** | Account lockout triggered after 5 consecutive failed login attempts (`failedLoginCount >= 5`), setting `lockUntil` to 15 minutes in the future. Returns `423 ACCOUNT_LOCKED`. | [`apps/api/src/controllers/auth.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/controllers/auth.ts)<br>[`apps/api/src/models/User.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/models/User.ts) |
| **Account Enumeration & Timing Attacks** | Identical error messages (`"Invalid email or password"`) and status code (`401 Unauthorized`) for non-existent emails and wrong passwords. `POST /api/v1/auth/forgot-password` always returns identical generic 200 OK success responses. | [`apps/api/src/controllers/auth.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/controllers/auth.ts) |
| **Weak Passwords** | Enforced password complexity: min 8, max 100 chars, containing at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special symbol. | [`packages/shared/src/schemas.ts`](file:///c:/Users/Admin/Downloads/YourStore/packages/shared/src/schemas.ts) |
| **Offline Password Cracking** | Passwords hashed using **Argon2id** (`memoryCost: 64MB`, `timeCost: 3`, `parallelism: 1`). | [`apps/api/src/lib/password.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/lib/password.ts) |
| **Account Hijacking via Reset Replay** | Password reset & email verification tokens are cryptographically random (32 bytes), expiring (reset: 1h, verify: 24h), stored only as SHA-256 hashes, and invalidated immediately upon first use (`single-use`). Password reset additionally revokes all refresh tokens. | [`apps/api/src/controllers/auth.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/controllers/auth.ts)<br>[`apps/api/src/lib/email.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/lib/email.ts) |
| **Privilege Escalation & Unauthorized Access** | `authenticate` middleware verifies JWT signatures and claims; `requireRole(...roles)` guards role-restricted endpoints (e.g., `admin`), rejecting unauthorized users with `403 FORBIDDEN`. | [`apps/api/src/middleware/auth.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/middleware/auth.ts) |
| **Sensitive Data Exposure in Responses & DB Queries** | `passwordHash`, `refreshTokenHash`, `emailVerificationTokenHash`, and `resetPasswordTokenHash` are marked with `select: false` in Mongoose and are stripped by `toJSON` and `toObject` transform hooks. | [`apps/api/src/models/User.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/models/User.ts) |
| **PII & Secrets Leaked in Log Files** | Pino logger configured with automated redaction paths for passwords, password hashes, JWTs, refresh tokens, emails, phone numbers, credit card details, cookies, and `Authorization` headers. | [`apps/api/src/lib/logger.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/lib/logger.ts)<br>[`apps/api/src/middleware/requestLogger.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/middleware/requestLogger.ts) |
| **Administrative / Security Blindspots** | Audit log helper records security-critical events (lockouts, token reuse detections, password resets, role changes) to the `AuditLog` collection. | [`apps/api/src/models/AuditLog.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/models/AuditLog.ts)<br>[`apps/api/src/lib/auditLog.ts`](file:///c:/Users/Admin/Downloads/YourStore/apps/api/src/lib/auditLog.ts) |

---

## 2. Known Limitations

1. **Single Active Session per Account (Single Refresh Token):**
   - The user document stores a single `refreshTokenHash`. Consequently, logging in from a second device or browser replaces the stored hash, which invalidates the refresh capability of the first device on its next rotation attempt. Supporting concurrent multi-device sessions would require an array of hashed session tokens.
2. **Role Propagation Window (Stateless Access Token):**
   - User roles are encoded inside the stateless 15-minute JWT access token. If an administrator demotes or alters a user's role, the change will not take effect on existing access tokens until they expire (up to a 15-minute window) and are rotated via `/api/v1/auth/refresh`.

---

## 3. Future Threat Coverage (Phases 2–7)

The following security controls specified in Section 8 of `PROJECT_BRIEF.md` will be implemented in subsequent phases:
- **Phase 2:** Signed Cloudinary upload endpoints and strict media validation (file type, file size, max 6 images).
- **Phase 3:** Stripe webhook cryptographic signature verification (`stripe-signature`), event idempotency tracking in `WebhookEvent`, server-side price recalculation, and atomic stock decrement/restoration.
- **Phase 3 & 5:** Resource ownership validation across orders, reviews, addresses, and user profiles (IDOR prevention).
- **Phase 7:** Automated `npm audit` and Dependabot workflows in GitHub Actions.
