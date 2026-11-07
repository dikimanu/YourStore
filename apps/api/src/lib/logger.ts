import pino from "pino";
import { env } from "../env.js";

const REDACT_PATHS = [
  "password",
  "passwordHash",
  "*.password",
  "*.passwordHash",
  "body.password",
  "body.confirmPassword",
  "token",
  "refreshToken",
  "refreshTokenHash",
  "accessToken",
  "*.token",
  "*.refreshToken",
  "*.refreshTokenHash",
  "body.token",
  "email",
  "phone",
  "*.email",
  "*.phone",
  "body.email",
  "body.phone",
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
  "creditCard",
  "cardNumber",
  "cvv",
  "*.creditCard",
  "*.cardNumber",
  "*.cvv",
];

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : env.NODE_ENV === "production" ? "info" : "debug",
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
  },
  base: {
    env: env.NODE_ENV,
  },
});
