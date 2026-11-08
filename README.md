# YourStore

A production-ready, multi-category full-stack e-commerce platform built as a TypeScript monorepo with Next.js App Router and Express.

- **Live demo:** [https://yourstore.example.com](https://yourstore.example.com) *(link placeholder)*
- **Screenshots:** *(placeholder)*

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
- Multi-category product catalog with debounced search, facets, and sorting.
- Product detail pages with dynamic variants, stock availability, category attributes, and vehicle enquiry forms.
- ISR (`revalidate: 60`) for home, category, and product detail pages with instant on-demand revalidation.
- Shopping cart with guest-to-account cart merging upon authentication.
- Multi-step checkout with saved address management, coupon code discounts, Stripe Checkout, and Cash on Delivery.
- Customer dashboard for order tracking, order timeline status, cancellations, and return requests.
- Wishlist, recently viewed items, product customer reviews, and responsive sticky mobile navigation.

### Admin Dashboard
- Analytics dashboard with sales-by-day charts, KPI totals, status breakdowns, top-selling products, and low-stock alerts.
- Order management with date, status, payment method/status filtering, search, and forward status progression.
- Return request decision management (approve, reject, process refunds).
- Catalog management with create, edit, inline stock adjustment, and soft deletion.
- Bulk product import via CSV with browser preview, formula injection sanitization, and atomic commit.
- Coupon management (percentage / flat discounts, expiry, usage limits).
- Customer directory with lifetime order counts and total spend aggregation.
- Enquiries & scheduled showroom visit management.
- System audit log monitoring with actor attribution.

---

## Local Setup

### Prerequisites
- Node.js `24.x` (or `>= 20.x`)
- npm `10.x` or higher
- Local or cloud MongoDB instance
- Stripe CLI (optional, for local webhook testing)

### Installation & Configuration

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/your-org/yourstore.git
   cd yourstore
   npm install
   ```

2. **Environment Files:**
   Copy `.env.example` in both apps:
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```

3. **Required Environment Variables:**
   - **`apps/api/.env`**:
     - `PORT`: Port for Express API server (e.g. 4000).
     - `NODE_ENV`: Application environment (`development` or `production`).
     - `MONGO_URI`: MongoDB connection string.
     - `JWT_ACCESS_SECRET`: Secret key for signing 15-minute access tokens (min 32 chars).
     - `JWT_REFRESH_SECRET`: Secret key for signing 7-day refresh tokens (min 32 chars).
     - `CLIENT_ORIGIN`: Allowed CORS frontend origin URL (e.g. `http://localhost:3000`).
     - `CLOUDINARY_CLOUD_NAME`: Cloudinary account cloud name.
     - `CLOUDINARY_API_KEY`: Cloudinary API credential key.
     - `CLOUDINARY_API_SECRET`: Cloudinary API credential secret.
     - `STRIPE_SECRET_KEY`: Stripe API secret key (`sk_test_...`).
     - `STRIPE_WEBHOOK_SECRET`: Stripe signing secret for webhook verification (`whsec_...`).
     - `RESEND_API_KEY`: Resend API key for sending emails.
     - `EMAIL_FROM`: Sender email address for notifications.
     - `REVALIDATE_SECRET`: Shared secret token for Next.js on-demand ISR revalidation.
     - `SENTRY_DSN`: Optional Sentry DSN for API error reporting.
     - `SHIPPING_FLAT`: Flat shipping charge in INR.
     - `FREE_SHIPPING_THRESHOLD`: Order subtotal threshold in INR for free shipping.
     - `TAX_PERCENT`: Applicable GST percentage rate.
     - `SEED_ADMIN_PASSWORD`: Default password for the seeded admin user.
     - `SEED_USER_PASSWORD`: Default password for the seeded customer user.
   - **`apps/web/.env`**:
     - `NEXT_PUBLIC_SITE_URL`: Canonical site URL (e.g. `http://localhost:3000`).
     - `API_URL`: Backend API URL targeted by Next.js server calls and rewrites (e.g. `http://localhost:4000`).
     - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`: Public cloud name for frontend image delivery.
     - `REVALIDATE_SECRET`: Shared secret matching the API for revalidation authorization.
     - `NEXT_PUBLIC_SENTRY_DSN`: Optional Sentry DSN for web client error tracking.

4. **Build shared packages:**
   ```bash
   npm run build --workspace=@yourstore/shared
   ```

5. **Seed the database:**
   ```bash
   npm run seed
   ```
   *Creates `admin@yourstore.test` (password from `SEED_ADMIN_PASSWORD`) and `customer@yourstore.test` (password from `SEED_USER_PASSWORD`) alongside category catalog items.*

6. **Run development servers:**
   ```bash
   npm run dev
   ```
   - Storefront & Admin UI: `http://localhost:3000`
   - Express REST API: `http://localhost:4000`

7. **Run tests:**
   ```bash
   # Unit and integration test suites
   npm test

   # Playwright end-to-end tests
   npm run test:e2e
   ```

---

## Stripe Local Testing

- **Test Card Number:** `4242 4242 4242 4242`
- **Expiry:** Any future month/year (e.g. `12/34`)
- **CVC:** Any 3 digits (e.g. `123`)
- **Postal Code:** Any valid format (e.g. `400001` or `90210`)

To test asynchronous webhook fulfillment locally, forward Stripe events to the API endpoint:
```bash
stripe listen --forward-to localhost:4000/api/v1/webhooks/stripe
```
Copy the webhook signing secret displayed by the CLI (`whsec_...`) into `STRIPE_WEBHOOK_SECRET` in `apps/api/.env`.

---

## Deployment Guide

Follow these numbered steps to deploy YourStore to production on free tiers:

1. **MongoDB Atlas (Database):**
   - Create an M0 free tier cluster.
   - Under **Database Access**, create a user with read/write permissions.
   - Under **Network Access**, add `0.0.0.0/0` (allow access from anywhere, as Render uses dynamic IPs).
   - Copy the SRV connection URI for `MONGO_URI`.

2. **Cloudinary (Media Storage):**
   - Sign up for a free Cloudinary account.
   - Note down `Cloud Name`, `API Key`, and `API Secret` from the dashboard.

3. **Stripe (Payment Gateway):**
   - Create a Stripe account in Test mode.
   - Note down the `Publishable Key` and `Secret Key`.
   - Add a Webhook Endpoint targeting `https://<your-render-api-url>/api/v1/webhooks/stripe`.
   - Listen for events: `checkout.session.completed` and `checkout.session.expired`.
   - Reveal and copy the webhook signing secret (`whsec_...`).

4. **Resend (Email Delivery):**
   - Generate an API key in Resend.
   - Configure a verified sender domain or use the sandbox sender address for `EMAIL_FROM`.

5. **Render (Backend API):**
   - Create **ONE** Web Service connected to your repository.
   - Select Node runtime and a region close to your target users and Atlas cluster.
   - **Build Command:** `npm ci && npm run build --workspace=@yourstore/shared && npm run build --workspace=apps/api`
   - **Start Command:** `npm run start --workspace=apps/api`
   - Configure all environment variables listed under `apps/api/.env`. Set `CLIENT_ORIGIN` to the exact Vercel frontend URL (e.g. `https://yourstore.vercel.app`).

6. **Vercel (Frontend App):**
   - Import the repository into Vercel and configure the root directory to `apps/web`.
   - Set environment variables:
     - `API_URL`: The deployed Render API URL (e.g. `https://yourstore-api.onrender.com`).
     - `NEXT_PUBLIC_SITE_URL`: Your Vercel domain (e.g. `https://yourstore.vercel.app`).
     - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`: Your Cloudinary cloud name.
     - `REVALIDATE_SECRET`: The exact same secret key set on the Render API.

7. **cron-job.org (Keep-Alive Ping):**
   - Configure a recurring HTTP cron monitor on [cron-job.org](https://cron-job.org) targeting `GET https://<your-render-api-url>/health` every 10 minutes to prevent Render free-tier instances from spinning down after inactivity.

8. **Final Smoke Test Checklist:**
   - [ ] Sign in with the seeded admin account.
   - [ ] Browse product catalog and add an item to the cart.
   - [ ] Complete a test checkout via Stripe with test card `4242...`.
   - [ ] Verify the Stripe webhook fires and updates the order status to `Placed`.
   - [ ] Confirm receipt of the order confirmation email in Resend logs.
   - [ ] Access the `/admin` dashboard and verify orders, sales metrics, and product management.

---

## Known Limitations

- **Guest Cart:** Guest cart items are maintained in browser memory and persist across navigation, but will reset upon a full page reload until the user logs in.
- **Expired Stripe Sessions:** If a customer completes payment through Stripe after a checkout session has expired on the backend, a manual refund or status reconciliation must be performed.
- **Playwright E2E Tests:** End-to-end tests are configured and ready in the repository but have not yet been executed or passed against live test environments.
- **PWA Icons:** Manifest icons in `apps/web` use placeholder assets.
- **Audit Advisories:** `npm audit` reports minor advisories on `postcss` (bundled transitively in Next.js 15) and `zod` pending upstream package releases.

---

## Repository Scripts

All commands can be executed from the repository root:

| Script | Command | Description |
| :--- | :--- | :--- |
| `npm run dev` | `concurrently ...` | Runs both the Next.js web application and the Express API server concurrently |
| `npm run build` | `npm run build --workspaces` | Compiles the shared package, Express backend, and Next.js frontend in sequence |
| `npm run lint` | `eslint` | Lints all packages and applications with ESLint and Next.js rules |
| `npm run typecheck` | `tsc --build` | Runs TypeScript project reference typechecking across all workspaces |
| `npm test` | `vitest run` | Runs unit, controller, and integration test suites |
| `npm run test:e2e` | `playwright test` | Runs the Playwright end-to-end browser tests |
| `npm run seed` | `npm run seed --workspace=@yourstore/api` | Seeds the database with default admin, customer, categories, and products |
| `npm run format` | `prettier --write ...` | Formats files across the repository using Prettier |
