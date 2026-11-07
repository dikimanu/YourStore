import express from "express";
import { pingDb } from "../db.js";

const router = express.Router();

router.get("/health", (_req, res, next) => {
  pingDb()
    .then((dbOk) => {
      res.json({
        status: "ok",
        db: dbOk ? "up" : "down",
        uptime: Math.floor(process.uptime()),
      });
    })
    .catch(next);
});

export default router;