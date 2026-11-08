import { test, expect } from "@playwright/test";
import { login, readEnv } from "./helpers";

test("Admin: advance newest Placed order to Processing", async ({ page }) => {
  const adminEmail = readEnv("E2E_ADMIN_EMAIL");
  const adminPassword = readEnv("E2E_ADMIN_PASSWORD");

  // 1. Log in as admin
  await login(page, adminEmail, adminPassword);

  // 2. Open /admin/orders
  await page.goto("/admin/orders");
  await expect(page.getByRole("heading", { name: "Order Management" })).toBeVisible();

  // 3. Find the newest row with status "Placed" and advance it
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toBeVisible();

  const placedRow = rows.filter({ hasText: "Placed" }).first();
  await expect(placedRow).toBeVisible();

  // Find the advance-status button ("→ Processing") in this row
  const advanceButton = placedRow.getByRole("button", { name: "→ Processing" });
  await expect(advanceButton).toBeVisible();
  await advanceButton.click();

  // 4. Assert its status changes to Processing
  await expect(placedRow.getByText("Processing", { exact: true })).toBeVisible();
});
