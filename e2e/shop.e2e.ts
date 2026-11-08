import { test, expect } from "@playwright/test";
import { login, readEnv } from "./helpers";

test("Shop: browse, add to cart, checkout with COD and verify order status", async ({ page }) => {
  const customerEmail = readEnv("E2E_CUSTOMER_EMAIL");
  const customerPassword = readEnv("E2E_CUSTOMER_PASSWORD");

  // 0. Log in first so the cart is saved on the server
  await login(page, customerEmail, customerPassword);

  // 1. Browse /products
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "All Products" })).toBeVisible();

  // Find product cards and locate the first purchasable product (not marked "Enquiry" or "Archived")
  const productCards = page.locator("a[href^='/product/']");
  await expect(productCards.first()).toBeVisible();

  const count = await productCards.count();
  let clicked = false;
  for (let i = 0; i < count; i++) {
    const card = productCards.nth(i);
    const hasEnquiry = await card.getByText("Enquiry", { exact: true }).count();
    const hasArchived = await card.getByText("Archived", { exact: true }).count();
    if (hasEnquiry === 0 && hasArchived === 0) {
      await card.click();
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    // Fallback if no card excluded
    await productCards.first().click();
  }

  // 2. Open purchasable product and add it to cart
  const addToCartButton = page.getByRole("button", { name: "Add to Cart" });
  await expect(addToCartButton).toBeVisible();
  await addToCartButton.click();

  // 4. Go to /cart
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Shopping Cart" })).toBeVisible();

  const checkoutLink = page.getByRole("link", { name: "Proceed to Checkout" });
  await expect(checkoutLink).toBeVisible();
  await checkoutLink.click();

  // 5. Checkout page
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

  // Pick an address (or add one if none exists)
  const radioAddresses = page.locator("input[type='radio'][name='address']");
  const addressCount = await radioAddresses.count();

  if (addressCount === 0) {
    // Add address
    const addAddressButton = page.getByRole("button", { name: "+ Add a new address" });
    const addOneLink = page.getByRole("button", { name: "Add one" });

    if (await addOneLink.isVisible()) {
      await addOneLink.click();
    } else if (await addAddressButton.isVisible()) {
      await addAddressButton.click();
    }

    await page.getByPlaceholder("Label (e.g. Home, Office)").fill("Home");
    await page.getByPlaceholder("Full Name").fill("Test Customer");
    await page.getByPlaceholder("Phone").fill("9876543210");
    await page.getByPlaceholder("Address Line 1").fill("123 Market Street");
    await page.getByPlaceholder("City").fill("Mumbai");
    await page.getByPlaceholder("State").fill("Maharashtra");
    await page.getByPlaceholder("Pincode").fill("400001");

    await page.getByRole("button", { name: "Save Address" }).click();
    await expect(radioAddresses.first()).toBeVisible();
  }

  // Ensure first address radio is checked
  await radioAddresses.first().check();

  // 6. Choose Cash on Delivery and place the order
  const codButton = page.getByRole("button", { name: "Cash on Delivery" });
  await expect(codButton).toBeEnabled();
  await codButton.click();

  // 7. Verify order placed and open /orders
  await expect(page).toHaveURL(/\/orders\//);

  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "My Orders" })).toBeVisible();

  // Assert order is listed with status Placed
  const placedBadge = page.getByText("Placed", { exact: true }).first();
  await expect(placedBadge).toBeVisible();
});
