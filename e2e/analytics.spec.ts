// Forecast vs. Actual Analytics (S8, NFR6) against the demo seed: 8 SKUs, 30 days of history, 30 days of waste.
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
    await page.goto("/analytics");
});

test("shows the page, model and sidebar state", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Forecast vs. Actual Analytics" })).toBeVisible();
    await expect(page.getByText("Central Salaya").first()).toBeVisible();
    await expect(page.getByText(/Model: LightGBM ONNX/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Forecast vs. Actual Analytics" })).toHaveAttribute("aria-current", "page");
});

test("7-day view: 7 chart points and 8 SKU rows with accuracy badges", async ({ page }) => {
    await expect(page.getByTestId("forecast-series").locator("tbody tr")).toHaveCount(7);
    await expect(page.getByText("Units per day · 8 SKUs · last 7 days")).toBeVisible();

    const rows = page.getByTestId("sku-row");
    await expect(rows).toHaveCount(8);
    for (const row of await rows.all()) {
        await expect(row.getByText(/^● (Good|Fair|Review)$/)).toBeVisible();
        await expect(row.getByText(/\d+(\.\d)?%$/).last()).toBeVisible(); // MAPE
    }
    // The seed gives SB078 the smallest noise and ST068 the largest
    await expect(rows.filter({ hasText: "SB078" })).not.toContainText("Review");
    await expect(rows.filter({ hasText: "ST068" })).not.toContainText("Good");
});

test("30-Day toggle switches the window", async ({ page }) => {
    await page.getByRole("link", { name: "30-Day" }).click();
    await expect(page).toHaveURL(/range=30/);
    await expect(page.getByTestId("forecast-series").locator("tbody tr")).toHaveCount(30);
    await expect(page.getByRole("link", { name: "30-Day" })).toHaveAttribute("aria-current", "true");
});

test("category filter keeps only that category's SKUs", async ({ page }) => {
    await page.getByLabel("Category").selectOption("SB");
    await expect(page).toHaveURL(/category=SB/);
    const rows = page.getByTestId("sku-row");
    await expect(rows).toHaveCount(3);
    for (const sku of ["SB062", "SB078", "SB094"]) await expect(rows.filter({ hasText: sku })).toHaveCount(1);
    await expect(page.getByText("Units per day · 3 SKUs")).toBeVisible();
});

test("an unknown category in the URL falls back to all SKUs", async ({ page }) => {
    await page.goto("/analytics?category=XX&range=999");
    await expect(page.getByTestId("sku-row")).toHaveCount(8);
    await expect(page.getByTestId("forecast-series").locator("tbody tr")).toHaveCount(7);
});

test("waste totals match the seeded last 7 days", async ({ page }) => {
    const totals = page.locator("section", { has: page.getByRole("heading", { name: "Waste Totals" }) });
    await expect(totals.getByText("฿8,074")).toBeVisible(); // 1256+1221+1041+1063+1113+955+1425
    await expect(totals.getByText("฿1,153")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Food Waste Trend" })).toBeVisible();
});
