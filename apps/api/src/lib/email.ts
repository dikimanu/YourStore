import { Resend } from "resend";
import { env } from "../env.js";
import { logger } from "./logger.js";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const fromEmail = env.EMAIL_FROM || "onboarding@resend.dev";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  if (!resend) {
    logger.info(
      { to: options.to, subject: options.subject },
      "Resend API key not configured; email sending simulated.",
    );
    return true;
  }

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      logger.error({ error, to: options.to }, "Failed to send email via Resend");
      return false;
    }

    return true;
  } catch (err) {
    logger.error({ err, to: options.to }, "Unexpected error sending email via Resend");
    return false;
  }
}

export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  const verifyUrl = `${env.CLIENT_ORIGIN}/verify-email?token=${encodeURIComponent(token)}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Verify your email address</h2>
      <p>Thank you for registering with YourStore. Please click the button below to verify your email address:</p>
      <div style="margin: 30px 0;">
        <a href="${verifyUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
          Verify Email
        </a>
      </div>
      <p>Or paste this link into your browser: <br/><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>This link is single-use and will expire in 24 hours.</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: "Verify your YourStore account",
    html,
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  const resetUrl = `${env.CLIENT_ORIGIN}/reset-password?token=${encodeURIComponent(token)}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Reset your password</h2>
      <p>We received a request to reset your YourStore password. Click the button below to choose a new password:</p>
      <div style="margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p>Or paste this link into your browser: <br/><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link is single-use and will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: "Reset your YourStore password",
    html,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export type OrderEmailStatus = "placed" | "dispatched" | "delivered" | "cancelled" | "refunded";

function orderIdText(order: { _id?: unknown; id?: string }, fallback: string): string {
  if (typeof order.id === "string" && order.id) return order.id;
  const raw = order._id;
  if (typeof raw === "string") return raw;
  if (raw !== null && typeof raw === "object" && "toString" in raw) {
    return (raw as { toString(): string }).toString();
  }
  return fallback;
}
interface MinimalOrderForEmail {
  _id?: unknown;
  id?: string;
  user: unknown;
  items: Array<{
    title: string;
    qty: number;
    unitPrice: number;
    variantSku?: string | undefined;
  }>;
  pricing: {
    total: number;
  };
}

/**
 * Sends order status update emails (placed, dispatched, delivered, cancelled, refunded).
 * Uses Resend via sendEmail helper.
 * Never fails the caller: logs without PII on failure.
 * Skips sending if RESEND_API_KEY is not configured.
 */
export async function sendOrderStatusEmail(
  order: MinimalOrderForEmail,
  status: OrderEmailStatus,
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    logger.info({ status }, "RESEND_API_KEY is missing, skipping order status email.");
    return;
  }

  try {
    const orderId = orderIdText(order, "Order");
    let recipientEmail = "";

    if (order.user && typeof order.user === "object" && "email" in order.user) {
      recipientEmail = String((order.user as { email: string }).email);
    } else if (order.user) {
      const { User } = await import("../models/User.js");
      const userDoc = await User.findById(order.user).select("email").lean();
      if (userDoc && userDoc.email) {
        recipientEmail = userDoc.email;
      }
    }

    if (!recipientEmail) {
      logger.warn({ orderId, status }, "Could not determine user email for order status notification");
      return;
    }

    const titles: Record<OrderEmailStatus, string> = {
      placed: "Order Confirmed - YourStore",
      dispatched: "Your Order is on the Way! - YourStore",
      delivered: "Your Order has been Delivered - YourStore",
      cancelled: "Order Cancelled - YourStore",
      refunded: "Refund Processed - YourStore",
    };

    const statusHeadings: Record<OrderEmailStatus, string> = {
      placed: "Thank you for your order!",
      dispatched: "Your order has been dispatched!",
      delivered: "Your order has been delivered!",
      cancelled: "Your order has been cancelled.",
      refunded: "Your refund has been processed.",
    };

    const itemsHtml = order.items
      .map(
        (item) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
            ${escapeHtml(item.title)}${item.variantSku ? ` (${escapeHtml(item.variantSku)})` : ""}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.qty}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${item.unitPrice.toLocaleString("en-IN")}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${(item.unitPrice * item.qty).toLocaleString("en-IN")}</td>
        </tr>`,
      )
      .join("");

    const totalFormatted = `₹${order.pricing.total.toLocaleString("en-IN")}`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <h2 style="color: #111827; margin-bottom: 8px;">${statusHeadings[status]}</h2>
        <p style="margin-top: 0; color: #4b5563;">Order ID: <strong>#${escapeHtml(orderId)}</strong></p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <thead>
            <tr style="background-color: #f3f4f6; text-align: left;">
              <th style="padding: 8px;">Item</th>
              <th style="padding: 8px; text-align: center;">Qty</th>
              <th style="padding: 8px; text-align: right;">Price</th>
              <th style="padding: 8px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 12px 8px; font-weight: bold; text-align: right;">Grand Total:</td>
              <td style="padding: 12px 8px; font-weight: bold; text-align: right; color: #2563eb;">${totalFormatted}</td>
            </tr>
          </tfoot>
        </table>

        <p style="font-size: 14px; color: #6b7280;">
          If you have any questions, you can view your order status online at 
          <a href="${env.CLIENT_ORIGIN}/orders/${encodeURIComponent(orderId)}" style="color: #2563eb;">YourStore Orders</a>.
        </p>
      </div>
    `;

    await sendEmail({
      to: recipientEmail,
      subject: titles[status],
      html,
    });
  } catch (err) {
    // Log without PII (email, names, address)
    logger.error(
      {
        orderId: orderIdText(order, "unknown"),
        status,
        err: err instanceof Error ? err.message : String(err),
      },
      "Failed to send order status email",
    );
  }
}
