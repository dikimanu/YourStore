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
