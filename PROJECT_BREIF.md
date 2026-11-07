# YourStore: Antigravity Build Brief

By Satyabrata Pal. Save Part A as `PROJECT_BRIEF.md` in your repo root, then paste the Part B phase prompts into Antigravity one at a time.
 
## How to use this (free-quota friendly)

1. Create an empty GitHub repo and open it in Antigravity. Save Part A below as `PROJECT_BRIEF.md` in the repo root.
2. Paste the phase prompts from Part B one at a time, in order. Do not paste everything at once: one giant task burns the free quota and produces broken code.
3. After each phase, run the app, run `npm run lint && npm run typecheck && npm test`, then `git commit`. Only then start the next phase.
4. Use a Flash model for routine phases (UI, CRUD). Use Gemini Pro for Phases 1, 3 and 7. Paste the Phase 1 and Phase 3 code into Claude for a security review before you deploy.
5. If the agent drifts, tell it: Re-read PROJECT\_BRIEF.md and follow it exactly.

## Part A: Master brief (save as PROJECT\_BRIEF.md)

### 1. Goal

Build **YourStore**, a production-quality, multi-category e-commerce platform with a customer storefront, an admin panel and a secure REST API. It is a portfolio project, so code quality, security, tests, documentation and smooth UX matter as much as features. Everything must run on permanent free tiers: no paid service and no credit card (Stripe runs in test mode only). Currency is INR (₹).

### 2. Fixed free-tier stack (do not substitute)

| Layer | Technology | Host |
| --- | --- | --- |
| Web | Next.js (App Router) + TypeScript + Tailwind | Vercel |
| API | Node.js + Express + TypeScript | Render free web service (ONE service only) |
| Database | MongoDB Atlas M0 + Mongoose | Atlas (500 MB cap, no binary data) |
| Media | Cloudinary free plan | store only URLs and publicIds |
| Payments | Stripe test mode + Cash on Delivery | - |
| Email | Resend free tier | - |
| Validation | Zod, shared between web and api | - |
| Client data | TanStack Query; Zustand for cart UI state | - |
| Auth | JWT access token + rotating refresh token in httpOnly cookies; argon2 (or bcrypt cost 12) | - |
| Monitoring | Sentry free tier, pino logs | - |
| Tests / CI | Vitest, Supertest, Playwright, GitHub Actions | - |

### 3. Free-tier constraints that shape the design

- **Render sleeps after 15 minutes idle and takes about a minute to wake.** Therefore: browsing pages (home, category, product) use ISR or server caching so they never wait on the API; add `GET /health` that runs a tiny DB query (an external cron pings it every 10 minutes); keep the API stateless (no local files, nothing in memory that correctness depends on); use only one Render service.
- **Cloudinary free is one shared 25-credit pool, and every distinct transformation counts.** Use only four fixed presets through one helper `imageUrl(publicId, preset)`: thumb 200w, card 400w, detail 800w, zoom 1400w, always with `f_auto,q_auto`. Max 6 images per product, 10 MB per upload, compress in the browser before upload.
- **Atlas M0 has a 500 MB cap.** No unbounded embedded arrays, always paginate, use `.lean()`, create the indexes listed below, seed at most about 80 products.
- **Cookies must be first-party.** Next.js rewrites proxy `/api/*` to the Render API URL, so the browser only ever talks to one origin.

### 4. Monorepo layout (npm workspaces)

```
apps/web         Next.js storefront + /admin route group (role guarded, code split)
apps/api         Express API
packages/shared  Zod schemas, TS types, constants (categories, order statuses, image presets)
```

Also create: `.env.example` for each app, `README.md`, `SECURITY.md`, `ARCHITECTURE.md` (with a mermaid diagram), `.github/workflows/ci.yml`.

### 5. Environment variables (never commit real values)

- **API:** PORT, NODE\_ENV, MONGO\_URI, JWT\_ACCESS\_SECRET, JWT\_REFRESH\_SECRET, CLIENT\_ORIGIN, CLOUDINARY\_CLOUD\_NAME, CLOUDINARY\_API\_KEY, CLOUDINARY\_API\_SECRET, STRIPE\_SECRET\_KEY, STRIPE\_WEBHOOK\_SECRET, RESEND\_API\_KEY, EMAIL\_FROM, REVALIDATE\_SECRET, SENTRY\_DSN, SHIPPING\_FLAT, FREE\_SHIPPING\_THRESHOLD, TAX\_PERCENT.
- **Web:** NEXT\_PUBLIC\_SITE\_URL, API\_URL (server-side proxy target), NEXT\_PUBLIC\_CLOUDINARY\_CLOUD\_NAME, REVALIDATE\_SECRET, NEXT\_PUBLIC\_SENTRY\_DSN.
- Validate env with Zod at startup and fail fast with a clear message.

### 6. Data models (Mongoose, with Zod schemas in packages/shared)

- **User:** name, email (unique, lowercase), passwordHash, role (`user` | `admin`), emailVerified, addresses\[\] (label, name, phone, line1, line2, city, state, pincode), wishlist\[productId\], cart\[{productId, variantSku, qty}\], refreshTokenHash, failedLoginCount, lockUntil.
- **Product:** title, slug (unique), description, category (`gadgets` | `clothing` | `electronics` | `vehicles` | `home`), brand, basePrice, images\[{url, publicId, alt}\] (max 6), attributes (object validated by a per-category Zod schema: electronics = storage, RAM, warranty, powerRating; clothing = gender, ageGroup, material; vehicles = modelYear, mileage, fuelType, transmission, condition; home = dimensions, weight, material), variants\[{sku, options{size, color}, priceOverride, stock}\], stock (for products without variants), listingType (`purchasable` | `enquiry`), ratingAvg, ratingCount, isActive. **Indexes:** text on title+description; (category, price); slug unique; isActive.
- **Order:** user, items\[\] as snapshots (productId, variantSku, title, image, unitPrice, qty), shippingAddress snapshot, pricing{subtotal, shipping, tax, discount, total}, payment{method `stripe` | `cod`, status, stripeSessionId, paymentIntentId}, status (`PendingPayment` | `Placed` | `Processing` | `Dispatched` | `OutForDelivery` | `Delivered` | `Cancelled` | `ReturnRequested` | `Returned` | `Refunded`), statusHistory\[{status, at, by, note}\].
- **Review:** user, product, rating 1-5, title, body (unique per user+product, verified buyers only).
- **Coupon:** code, type (`percent` | `fixed`), value, minOrder, expiresAt, usageLimit, usedCount, isActive.
- **Enquiry:** product, user (optional), name, phone, message, type (`enquiry` | `visit`), preferredDate.
- **WebhookEvent:** eventId (unique), type, processedAt (idempotency).
- **AuditLog:** actor, action, targetType, targetId, meta, at (admin actions).

### 7. Business rules

- **Prices:** the client sends only productId, variantSku and quantity. The server loads current prices and computes every total. Never trust client prices.
- **Stock:** use atomic conditional updates (a filter requiring `stock >= qty` plus `$inc`), never read-then-write. Decrement when the order is created; restore on cancellation, payment failure or Stripe session expiry.
- **Stripe:** the server creates the Checkout Session. The order starts as `PendingPayment`. Only the verified webhook (raw body, signature checked, event id stored for idempotency) moves it to `Placed`. Handle `checkout.session.completed` and `checkout.session.expired`.
- **COD:** the order goes straight to `Placed` with payment status pending; the admin marks it paid on delivery.
- **Order flow:** Placed → Processing → Dispatched → OutForDelivery → Delivered. Cancel is allowed only before Dispatched. A return request is allowed within 7 days after Delivered; the admin approves it, then Returned → Refunded. Every change is appended to statusHistory and emails the customer.
- **Vehicles:** `listingType = enquiry`; no cart or checkout; show Enquire and Book a visit forms that create an Enquiry.
- **Shipping and tax:** flat shipping fee, free above a threshold, tax percent from env.
- **Coupons:** percent or fixed, minimum order, expiry, usage limit, validated server-side.
- **Deleting a product is a soft delete** (`isActive = false`); old orders keep their snapshots.
- **Reviews:** only users with a Delivered order containing the product, one per product.

### 8. Security requirements (document each in SECURITY.md)

- helmet with a strict CSP, strict CORS (only CLIENT\_ORIGIN), `express-rate-limit` (tighter on auth routes), `express-mongo-sanitize`, Zod validation on every request body, query and param, and a request body size limit.
- Access token 15 minutes, refresh token 7 days with rotation and reuse detection; both in httpOnly, Secure, SameSite=Lax cookies. CSRF protection for state-changing requests (custom header check or double-submit token).
- Account lockout after repeated failed logins; identical error messages for unknown email and wrong password; password strength rules; email verification; password reset with single-use, expiring tokens (store only hashed tokens).
- Role middleware on every admin route; ownership checks on every user resource (no IDOR); never return passwordHash or tokens.
- Stripe webhook signature verification and idempotency; server-side pricing; atomic stock.
- Validate uploads (type, size, count); signed Cloudinary uploads.
- Audit log for admin actions; pino logs without PII or secrets.
- `npm audit` and Dependabot in CI; no secrets in the repo.

### 9. Performance and UX requirements

- ISR (revalidate 60 s) for home, category and product pages, plus an on-demand revalidate endpoint (protected by REVALIDATE\_SECRET) called when the admin changes a product.
- Skeleton loaders, blur placeholders on images, `next/image` with a Cloudinary loader that uses only the four presets.
- Optimistic updates for cart and wishlist; debounced search with suggestions; link prefetching; pagination (or infinite scroll) everywhere.
- Mobile-first, sticky Add to cart on mobile, dark mode, accessible (labels, focus states, contrast), friendly error toasts, empty states and a 404 page.
- Target Lighthouse 90+ on home and product pages.
- SEO: metadata per page, sitemap.xml, robots.txt, Product JSON-LD.
- A loading screen with a friendly message if the API is waking up.

### 10. Features

- **Customer:** registration and login, email verification, password reset; category navigation; search with suggestions, filters (price, stock, brand, category attributes) and sorting; product page with image gallery and zoom, variant selector, stock badge, related products, recently viewed; cart that merges guest and logged-in carts; saved addresses; checkout with Stripe test mode or COD; order history with status timeline; cancel before dispatch; return request; invoice PDF download; reviews and ratings; wishlist; coupons; vehicle enquiry and visit booking; legal pages (Privacy, Terms, Shipping and Returns).
- **Admin (/admin):** dashboard (sales chart, order counts, low-stock alerts); product add and edit with a category-adaptive form, variant editor and multi-image upload; product list with search, stock editing and soft delete; CSV bulk import; order board with search, filters and status advancement; return approvals; coupons; enquiries; customer list; audit log view.
- **Emails (Resend):** welcome and verify, password reset, order placed, dispatched, delivered, cancelled, refunded.

### 11. API surface (`/api/v1`)

`auth` (register, login, refresh, logout, verify-email, forgot/reset password, me), `products` (list with filters and pagination, detail by slug, suggestions, related), `categories`, `cart`, `wishlist`, `addresses`, `coupons/validate`, `checkout` (create Stripe session, place COD order), `webhooks/stripe`, `orders` (mine, detail, cancel, return request, invoice), `reviews`, `enquiries`, and `admin/*` (products, uploads sign, orders, returns, coupons, customers, enquiries, stats, audit log, CSV import). Return consistent JSON errors: `{ error: { code, message, details? } }`.

### 12. Quality bar and definition of done

- TypeScript strict mode, ESLint and Prettier, no `any` without a comment, no dead code, no TODO placeholders.
- API tests (Vitest + Supertest): auth and lockout, price tampering, concurrent purchase of the last item (stock never goes negative), Stripe webhook idempotency and bad signature, IDOR checks, admin-only access.
- Playwright end-to-end: browse, add to cart, COD checkout, see the order; admin advances the order status.
- `npm run seed` creates an admin user, a demo customer and about 60 realistic products across all categories (with variants for clothing).
- CI runs lint, typecheck, tests and build on every push.
- README has: live demo link placeholder, screenshots placeholder, tech table, architecture diagram, features, setup steps, deployment guide (Vercel, Render, Atlas, Cloudinary, Stripe webhook, cron ping) and the Stripe test card 4242 4242 4242 4242.

### 13. Rules for the agent

- Work one phase at a time. Before coding, post a short plan. At the end of a phase, run lint, typecheck and tests, then summarize what was built and what to verify manually.
- Follow this brief exactly. If something is unclear, make the most reasonable choice, note it in the summary and continue. Ask a question only if you are truly blocked.
- Never invent or hard-code secrets. Never commit `.env`. Keep dependencies minimal and well known.
- Keep files small and well named; share types and Zod schemas through `packages/shared`.
- Do not start the next phase until told.

## Part B: Phase prompts (paste one at a time)

### Phase 0: Setup

Read PROJECT\_BRIEF.md fully. Do Phase 0 only: create the npm-workspaces monorepo (apps/web, apps/api, packages/shared) with TypeScript strict, ESLint, Prettier, Vitest, scripts for lint, typecheck, test, dev and build at the root, `.gitignore`, `.env.example` files with Zod env validation, `GET /health` that pings MongoDB, the Next.js `/api/*` rewrite to API\_URL, a base Tailwind layout with dark mode, and a starter CI workflow. Do not build features yet.

### Phase 1: Auth and security foundation

Do Phase 1 from PROJECT\_BRIEF.md: User model, register, login, refresh with rotation and reuse detection, logout, email verification and password reset (Resend), account lockout, role middleware, helmet, CORS, rate limiting, mongo-sanitize, Zod validation middleware, CSRF protection, the consistent error format, pino logging, and audit-log helper. Build the login, register, verify and reset pages in the web app. Add Supertest tests for lockout, token rotation and role protection. Start SECURITY.md.

### Phase 2: Catalog and admin product management

Do Phase 2: shared Zod schemas for categories and per-category attributes, the Product model with variants and indexes, the public product list (filters, sort, pagination, text search, suggestions), product detail by slug, signed Cloudinary upload endpoint, the `imageUrl` helper with the four fixed presets, and the admin product form (category-adaptive fields, variant editor, multi-image upload with client-side compression), product list with stock editing and soft delete, plus on-demand revalidation. Build the storefront home, category, search and product pages with ISR, skeletons and blur placeholders. Add `npm run seed` with about 60 products.

### Phase 3: Cart, checkout and orders

Do Phase 3: server-side cart (guest cart in the browser merges on login), saved addresses, coupon validation, server-side price computation, atomic stock decrement and restore, Stripe Checkout Session creation, the verified and idempotent Stripe webhook (completed and expired), Cash on Delivery, the Order model with statusHistory, order history and detail pages with the timeline, cancel before dispatch, and the admin order board with status advancement. Add Supertest tests for price tampering, last-item race condition, webhook idempotency and bad signatures, and IDOR.

### Phase 4: Storefront polish

Do Phase 4: product gallery with zoom, variant selector with per-variant stock badges, related products, recently viewed, wishlist, optimistic cart and wishlist updates, sticky mobile Add to cart, vehicle Enquire and Book a visit forms, legal pages, 404 and error pages, empty states, the API-waking loading screen, SEO (metadata, sitemap, robots, Product JSON-LD), and accessibility fixes. Target Lighthouse 90+ on home and product pages.

### Phase 5: Extra features

Do Phase 5: reviews and ratings (verified buyers only, updating ratingAvg and ratingCount), coupons management, order emails for every status change, invoice PDF generated on demand (no storage), return requests with admin approval and refund status, and a PWA manifest with install support.

### Phase 6: Admin dashboard

Do Phase 6: admin dashboard with sales chart, order counts, top products and low-stock alerts (Recharts), customer list, enquiries list, audit log view, order search and filters, and CSV bulk product import with validation and a preview of errors.

### Phase 7: Tests, CI, docs and deployment

Do Phase 7: complete the test suites and Playwright end-to-end flows from the brief, finish CI (lint, typecheck, tests, build, npm audit), enable Dependabot, finish SECURITY.md (each threat, the defence and where it lives in the code), ARCHITECTURE.md with a mermaid diagram, and a README with the full deployment guide for Vercel, Render (single service, region choice), Atlas, Cloudinary, the Stripe webhook and the cron-job.org ping of `/health` every 10 minutes. Do a final review against Section 12 of PROJECT\_BRIEF.md and list anything missing.
