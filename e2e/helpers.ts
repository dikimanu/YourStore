import { Page, expect } from "@playwright/test";

export function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);

  await page.getByRole("button", { name: "Log In" }).click();

  // Wait for login redirection away from /login
  await expect(page).not.toHaveURL(/\/login(?:\?.*)?$/);
}
