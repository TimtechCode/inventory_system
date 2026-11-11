import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Runs against the seeded e2e database (see playwright.config.ts). Tests run in order and later
// tests may depend on records created by earlier ones.

test.describe.configure({ mode: "serial" });

test("products list shows seeded stock, filters and searches", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ankara Wrap Dress" })).toBeVisible();

  await page.getByRole("link", { name: /^Low stock/ }).click();
  await expect(page).toHaveURL(/status=low/);
  await expect(page.getByRole("link", { name: "Vacuum Flask" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Canvas Sneaker" })).toHaveCount(0);

  await page.goto("/products");
  await page.getByRole("searchbox", { name: "Search" }).fill("awd-ind-m");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=awd-ind-m/);
  await expect(page.getByRole("link", { name: "Ankara Wrap Dress" })).toBeVisible();
  await expect(page.getByText("AWD-IND-M", { exact: true })).toBeVisible();
  await expect(page.getByText(/Showing 1–1 of 1 product/)).toBeVisible();

  await page.getByLabel("Category").selectOption({ label: "Footwear" });
  await expect(page).toHaveURL(/category=footwear/);
  await expect(page.getByText("No products match these filters")).toBeVisible();
});

test("sorting by price puts the most expensive product first", async ({ page }) => {
  await page.goto("/products");
  await page.getByRole("link", { name: "Price" }).click(); // ascending
  await page.getByRole("link", { name: "Price" }).click(); // descending
  await expect(page).toHaveURL(/sort=price&dir=desc/);
  const firstRow = page.getByRole("row").nth(1);
  await expect(firstRow.getByRole("link").first()).toHaveText("Classic Chronograph");
});

test("adds a category, a product type and a product with variants", async ({ page }) => {
  await page.goto("/categories/new");
  await page.getByLabel("Name").fill("Children");
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page).toHaveURL(/\/categories$/);
  await expect(page.getByRole("status")).toContainText("Category added");
  await expect(page.getByRole("link", { name: "Children" })).toBeVisible();

  await page.goto("/types/new");
  await page.getByLabel("Name", { exact: true }).fill("Kidswear");
  await page.getByRole("button", { name: "Add attribute" }).click();
  await page.getByLabel("Attribute name").fill("Age");
  await page.getByLabel("Option 1 for Age").fill("2-3");
  await page.getByLabel("Option 1 for Age").press("Enter");
  await page.getByLabel("Option 2 for Age").fill("4-5");
  await page.getByLabel(/Creates variants/).check();
  await page.getByRole("button", { name: "Add product type" }).click();
  await expect(page).toHaveURL(/\/types$/);
  await expect(page.getByRole("link", { name: "Kidswear" })).toBeVisible();

  await page.goto("/products/new");
  await page.getByLabel("Product name").fill("Ankara Romper");
  await page.getByLabel("Category").selectOption({ label: "Children" });
  await page.getByLabel("Product type").selectOption({ label: "Kidswear" });

  // Submitting without a price shows field errors and keeps the input.
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Fix the highlighted fields" })).toBeVisible();
  await expect(page.getByText("Enter a sales price")).toBeVisible();
  await expect(page.getByLabel("Product name")).toHaveValue("Ankara Romper");

  await page.getByLabel("Sales price (₦)").fill("9,500");
  await page.getByLabel("Varies by age").check();
  await page.getByText("2-3", { exact: true }).click();
  await page.getByText("4-5", { exact: true }).click();
  await expect(page.getByLabel("SKU for 2-3")).toHaveValue("ANKARA-ROMPER-23");
  await page.getByLabel("Quantity on hand for 2-3").fill("1");
  await page.getByLabel("Reorder level for 2-3").fill("2");
  await page.getByLabel("Quantity on hand for 4-5").fill("10");
  await page.getByLabel("Price for 4-5").fill("10,500");
  await page.getByRole("button", { name: "Add product" }).click();

  await expect(page.getByRole("heading", { name: "Ankara Romper", level: 1 })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Product added");
  await expect(page.getByText("₦9,500 – ₦10,500").first()).toBeVisible();
  const lowRow = page.getByRole("row", { name: /ANKARA-ROMPER-23/ });
  await expect(lowRow.getByText("Low stock")).toBeVisible();
});

test("edits stock and deletes the product", async ({ page }) => {
  await page.goto("/products?q=romper");
  await page.getByRole("link", { name: "Ankara Romper" }).click();
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Quantity on hand for 2-3").fill("12");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Changes saved");
  await expect(page.getByRole("row", { name: /ANKARA-ROMPER-23/ }).getByText("In stock")).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete product" }).click();
  await expect(page).toHaveURL(/\/products/);
  await expect(page.getByRole("status")).toContainText("Product deleted");
  await expect(page.getByRole("link", { name: "Ankara Romper" })).toHaveCount(0);
});

test("refuses to delete a category that still has products", async ({ page }) => {
  await page.goto("/categories");
  await page.getByRole("link", { name: "Footwear" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete category" }).click();
  await expect(page.getByRole("alertdialog").getByRole("alert")).toContainText("still has 3 products");
});

for (const path of ["/products", "/products/new", "/categories", "/types", "/types/new"]) {
  test(`has no detectable accessibility violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}
