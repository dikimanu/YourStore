import { logger } from "./logger.js";

/**
 * Triggers on-demand revalidation in the Next.js web application.
 * Revalidates home, category, and product detail paths.
 * If the web app is unreachable or returns an error, it logs the error
 * and does not fail the caller (resilient).
 */
export async function triggerRevalidation(paths: string[]): Promise<void> {
  const secret = process.env["REVALIDATE_SECRET"];
  if (!secret) {
    logger.warn("REVALIDATE_SECRET not set; skipping on-demand revalidation");
    return;
  }

  // Web app URL defaults to CLIENT_ORIGIN (e.g. http://localhost:3000)
  const clientOrigin = process.env["CLIENT_ORIGIN"] || "http://localhost:3000";
  const url = `${clientOrigin.replace(/\/$/, "")}/api/revalidate`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Revalidate-Secret": secret,
      },
      body: JSON.stringify({ paths }),
    });

    if (!response.ok) {
      const statusText = response.statusText;
      const text = await response.text().catch(() => "");
      logger.error(
        { status: response.status, statusText, text },
        "Failed to trigger on-demand revalidation in web app",
      );
    } else {
      logger.info({ paths }, "On-demand revalidation triggered successfully");
    }
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "Error contacting web app for revalidation (web app may be offline or unreachable)",
    );
  }
}
