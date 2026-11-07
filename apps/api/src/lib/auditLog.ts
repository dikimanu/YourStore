import mongoose, { Types } from "mongoose";
import { AuditLog, IAuditLog } from "../models/AuditLog.js";
import { logger } from "./logger.js";

export interface AuditLogPayload {
  actor: Types.ObjectId | string;
  action: string;
  targetType: string;
  targetId?: Types.ObjectId | string | null;
  meta?: Record<string, unknown> | null;
}

/**
 * Creates an audit log entry for administrative or security-sensitive actions.
 * Never throws — failures are logged to avoid failing the calling operation.
 */
export async function createAuditLog(
  payload: AuditLogPayload,
): Promise<IAuditLog | null> {
  try {
    const isConnected = mongoose.connection.readyState === mongoose.ConnectionStates.connected;
    if (!isConnected) {
      logger.warn(
        { action: payload.action, targetType: payload.targetType },
        "Skipping audit log persistence: database is not connected",
      );
      return null;
    }

    const entry = await AuditLog.create({
      actor: typeof payload.actor === "string" ? payload.actor : payload.actor.toString(),
      action: payload.action,
      targetType: payload.targetType,
      targetId: payload.targetId ? payload.targetId.toString() : null,
      meta: payload.meta ?? null,
      at: new Date(),
    });
    return entry;
  } catch (error) {
    logger.error(
      { err: error, action: payload.action, targetType: payload.targetType },
      "Failed to persist audit log entry",
    );
    return null;
  }
}

export const logAdminAction = createAuditLog;
