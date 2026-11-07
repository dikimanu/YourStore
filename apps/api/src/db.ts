import mongoose from "mongoose";
import { env } from "./env.js";

let connected = false;

export async function connectDb(): Promise<void> {
  if (!env.MONGO_URI) return;
  if (connected) return;
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  connected = true;
}

export async function pingDb(): Promise<boolean> {
  try {
    // 1 = connected (mongoose readyState)
    const state: number = mongoose.connection.readyState;
    if (state !== 1) return false;
    await mongoose.connection.db?.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}