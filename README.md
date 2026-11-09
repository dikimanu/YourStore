# YourStore

A production-ready, multi-category full-stack e-commerce platform (Gadgets, Electronics, Clothing, Vehicles, Home, Foods & Grocery, Books, Health & Wellness, Lab & Industrial Supplies) built as a TypeScript monorepo with Next.js App Router and Express.

- **Live demo:** [https://your-store-lemon.vercel.app](https://your-store-lemon.vercel.app)
- **API health:** [https://yourstore-api-t47n.onrender.com/health](https://yourstore-api-t47n.onrender.com/health) *(free tier: the first request after idle may take about a minute)*
- **Screenshots:** *(add 3 to 4 images: home hero, product page, admin dashboard, mobile view)*

---

## Tech Stack

| Layer | Technologies & Services |
| :--- | :--- |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS (Hosted on Vercel) |
| **Backend** | Express 4, TypeScript, Node.js (Hosted on Render free tier, single web service) |
| **Database** | MongoDB Atlas (M0 free tier) with Mongoose 8 ODM |
| **Media & CDN** | Cloudinary (Signed upload presets, auto WebP/AVIF formatting) |
| **Payments** | Stripe Checkout (Test mode) and Cash on Delivery (COD) |
| **Email** | Resend (Transactional order confirmations, auth verification & password resets) |
| **Validation & Types** | Zod in a dedicated shared package (`@yourstore/shared`) |
| **Testing & CI** | Vitest, Supertest, Playwright, and GitHub Actions CI |

---

## Architecture & Security

- Detailed architectural diagrams, request lifecycles, and component responsibilities are documented in [ARCHITECTURE.md](ARCHITECTURE.md).
- Security policies, threat mitigation matrix, and code locations are documented in [SECURITY.md](SECURITY.md).

---

## Features

### Customer Storefront
- Nine product categories with debounced search, facets, and sorting.
- Product detail pages with dynamic variants, stock availability, category attributes, and vehicle enquiry forms.
- ISR (`revalidate: 60`) for category and product detail pages with on-demand revalidation.
- Shopping cart with guest-to-account cart merging upon authentication.
- Checkout with saved addresses, coupon codes, Stripe Checkout, and Cash on Delivery.
- Order tracking with status timeline, cancellations, return requests, and invoice PDF download.
- Wishlist, recently viewed items, and product customer reviews.
- Netflix-style hero carousel on the home page (auto-advance, swipe, keyboard and reduced-motion support).
- Show/hide password toggle on all password fields, and a profile avatar menu (name, email, orders, admin link, sign out).
- Sticky blurred header with mobile drawer menu, responsive layouts from 320px phones to desktop, and dark mode.
- Contact page and a full footer with social links.
- Installable PWA (manifest), Product JSON-LD, sitemap and robots for SEO.

### Admin Dashboard
- Analytics dashboard with sales-by-day charts, KPI totals, status breakdowns, top-selling products, and low-stock alerts.
- Order management with date, status, payment method/status filtering, search, and forward status progression.
- Return request decisions (approve, reject, process refunds).
- Catalog management with create, edit, inline stock adjustment, and soft deletion.
- Bulk product import via CSV with browser preview, formula injection protection, and all-or-nothing commit.
- Coupon management (percentage / flat discounts, expiry, usage limits).
- Customer directory with lifetime order counts and total spend.
- Enquiries and showroom visit management.
- Audit log with actor attribution.

---

## Local Setup

### Prerequisites
- Node.js `>= 20.x`
- npm `10.x` or higher
- Local or cloud MongoDB instance
- Stripe CLI (optional, for local webhook testing)

### Installation & Configuration

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/dikimanu/YourStore.git
   cd YourStore
   npm install
   ```

2. **Environment files:**
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

3. **Required environment variables:**
   - **`apps/api/.env`**:
     - `PORT`: Port for the Express API (e.g. 4000).
     - `NODE_ENV`: `development` or `production`.
     - `MONGO_URI`: MongoDB connection string.
     - `JWT_ACCESS_SECRET`: Secret for 15-minute access tokens (min 16 chars, 32+ recommended).
     - `JWT_REFRESH_SECRET`: Secret for 7-day refresh tokens (min 16 chars, 32+ recommended).
     - `CLIENT_ORIGIN`: Allowed CORS origin (e.g. `http://localhost:3000`).
     - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: Cloudinary credentials.
     - `STRIPE_SECRET_KEY`: Stripe secret key (`sk_test_...`).
     - `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret (`whsec_...`).
     - `RESEND_API_KEY`: Resend API key.
     - `EMAIL_FROM`: Sender address for emails.
     - `REVALIDATE_SECRET`: Shared secret for on-demand revalidation.
     - `SENTRY_DSN`: Optional Sentry DSN.
     - `SHIPPING_FLAT`: Flat shipping charge in INR.
     - `FREE_SHIPPING_THRESHOLD`: Subtotal in INR above which shipping is free.
     - `TAX_PERCENT`: GST percentage.
     - `SEED_ADMIN_PASSWORD`, `SEED_USER_PASSWORD`: Passwords for the seeded admin and customer.
   - **`apps/web/.env.local`**:
     - `NEXT_PUBLIC_SITE_URL`: Canonical site URL.
     - `API_URL`: Backend URL used by server calls and the `/api/*` rewrite.
     - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`: Public Cloudinary cloud name.
     - `REVALIDATE_SECRET`: Must match the API value.
     - `NEXT_PUBLIC_SENTRY_DSN`: Optional Sentry DSN.

4. **Build shared packages:**
   ```bash
   npm run build --workspace=@yourstore/shared
   ```

5. **Seed the database (development only):**
   ```bash
   npm run seed
   ```
   Creates `admin@yourstore.test` (password from `SEED_ADMIN_PASSWORD`) and `customer@yourstore.test` (password from `SEED_USER_PASSWORD`), plus 84 products across 9 categories.

   > **Warning:** the seed wipes users and products. Never run it against a production database. Use the CSV import at `/admin/products/import` to add products instead.

6. **Run development servers:**
   ```bash
   npm run dev
   ```
   - Storefront and Admin UI: `http://localhost:3000`
   - Express API: `http://localhost:4000`

7. **Run tests:**
   ```bash
   npm test
   npm run test:e2e
   ```

---

## Stripe Local Testing

- **Test card:** `4242 4242 4242 4242`
- **Expiry:** any future date (e.g. `12/34`)
- **CVC:** any 3 digits

Forward webhook events to the local API:
```bash
stripe listen --forward-to localhost:4000/api/v1/webhooks/stripe
```
Copy the `whsec_...` secret it prints into `STRIPE_WEBHOOK_SECRET` in `apps/api/.env`.

---

## Deployment Guide

1. **MongoDB Atlas:**
   - Create an M0 free cluster.
   - Under **Database Access**, create a read/write user.
   - Under **Network Access**, allow `0.0.0.0/0` (Render uses dynamic IPs).
   - Copy the SRV connection string into `MONGO_URI`.
   - Use a separate database name for production (for example `yourstore_prod`).

2. **Cloudinary:**
   - Create a free account and note the Cloud Name, API Key and API Secret.

3. **Stripe:**
   - Use Test mode and note the Secret Key.
   - Add a webhook endpoint: `https://<render-url>/api/v1/webhooks/stripe`.
   - Listen for `checkout.session.completed` and `checkout.session.expired`.
   - Copy the signing secret (`whsec_...`).

4. **Resend:**
   - Create an API key and set `EMAIL_FROM` to a verified sender.

5. **Render (API):**
   - Create **one** Web Service from the repository, in a region close to your users and Atlas.
   - **Build command:** `npm ci && npm run build --workspace=@yourstore/shared && npm run build --workspace=apps/api`
   - **Start command:** `npm run start --workspace=apps/api`
   - Set all API environment variables. Set `CLIENT_ORIGIN` to the exact Vercel URL.

6. **Vercel (web):**
   - Import the repository with the root directory `apps/web`.
   - Set `API_URL` (Render URL), `NEXT_PUBLIC_SITE_URL` (Vercel URL), `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `REVALIDATE_SECRET` (same as the API).

7. **cron-job.org (keep-alive):**
   - Create a job: `GET https://<render-url>/health` every 10 minutes, so the free Render instance stays awake.

8. **Smoke test checklist:**
   - [ ] `/health` returns `{"status":"ok","db":"up"}`.
   - [ ] Sign in as the admin.
   - [ ] Browse products and add one to the cart.
   - [ ] Pay with the Stripe test card and confirm the order becomes `Placed`.
   - [ ] Confirm the order email arrives.
   - [ ] Open `/admin` and check orders, sales and product management.

---

## Known Limitations

- **Guest cart:** kept in browser memory only, so it resets on a full page reload until the user logs in.
- **Expired Stripe sessions:** a payment completed after the session expired needs a manual refund or reconciliation.
- **Cancelling paid Stripe orders:** refunded automatically through Stripe. If the refund call fails, the error is logged with the order id and needs a manual refund.
- **Playwright E2E:** run locally with the API on :4000 and web on :3000 already running. The shop and admin tests are not yet passing (cart step and admin locators need fixing). They are not run in CI.
- **Shared database:** development and production currently share one Atlas database. Use a separate database for production.
- **Seed:** `npm run seed` wipes users and products. Never run it in production.
- **PWA icons:** the manifest icons are placeholders.
- **Audit advisories:** `npm audit` reports advisories on `postcss` (bundled in Next 15) and `zod`, pending major upgrades.

---

## Repository Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| `npm run dev` | `concurrently ...` | Runs the web app and the API together |
| `npm run build` | `npm run build --workspaces` | Builds shared, API and web in order |
| `npm run lint` | `eslint` | Lints all packages |
| `npm run typecheck` | `tsc --build` | Typechecks all workspaces |
| `npm test` | `vitest run` | Runs unit and integration tests |
| `npm run test:e2e` | `playwright test` | Runs Playwright end-to-end tests |
| `npm run seed` | `npm run seed --workspace=@yourstore/api` | Seeds the dev database |
| `npm run format` | `prettier --write ...` | Formats the repository |