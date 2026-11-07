import "dotenv/config";
import { env } from "./env.js";
import express from "express";
import { connectDb } from "./db.js";
import healthRouter from "./routes/health.js";

const app = express();

app.use(express.json());
app.use(healthRouter);

export { app };

if (process.env["VITEST"] !== "true") {
  connectDb().catch((err) => {
    console.warn("MongoDB connection failed (db will show as down):", (err as Error).message);
  });

  app.listen(env.PORT, () => {
    console.log(`🚀 API listening on http://localhost:${env.PORT}`);
  });
}
