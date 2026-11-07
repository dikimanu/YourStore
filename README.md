# YourStore

A production-quality, multi-category e-commerce platform with a customer storefront and an admin panel, built as a portfolio project.
 
## Stack

| Layer      | Technology                              |
| ---------- | --------------------------------------- |
| Web        | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| API        | Node.js + Express + TypeScript          |
| Database   | MongoDB Atlas + Mongoose                |
| Validation | Zod (shared between web and API)        |
| Tests / CI | Vitest + GitHub Actions                 |

## Monorepo Structure

```
apps/web          Next.js storefront
apps/api          Express REST API
packages/shared   Zod schemas, TypeScript types, constants
```

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   # Fill in real values
   ```

3. **Run in development**
   ```bash
   npm run dev
   ```
   - Web: http://localhost:3000
   - API: http://localhost:4000

## Scripts

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Start API and Web concurrently       |
| `npm run build`      | Build all packages                   |
| `npm run lint`       | Run ESLint across the monorepo       |
| `npm run typecheck`  | TypeScript strict type-checking      |
| `npm test`           | Run Vitest across all packages       |
| `npm run format`     | Format with Prettier                 |

## Health Check

```
GET /health → { status: "ok", db: "up" | "down", uptime: <seconds> }
```

The API starts and responds even when MongoDB is not configured (`db: "down"`).
