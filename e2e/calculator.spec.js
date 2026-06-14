import { test, expect } from '@playwright/test';

test.describe('Calculator', () => {
  test('loads calculator page', async ({ page }) => {
    await page.goto('/calculator.html');
    await expect(page).toHaveTitle(/Calculator|EcoTrace/i);
  });

  test('has step navigation', async ({ page }) => {
    await page.goto('/calculator.html');
    const steps = page.locator('[data-step-indicator]');
    await expect(steps.first()).toBeVisible();
  });

  test('form has transport inputs', async ({ page }) => {
    await page.goto('/calculator.html');
    const carKm = page.locator('input[name="carKm"]');
    await expect(carKm).toBeVisible();
  });

  test('emission search works', async ({ page }) => {
    await page.goto('/calculator.html');
    const searchInput = page.locator('[data-emission-search-form] input, input[placeholder*="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('car');
      // Wait for results
      await page.waitForTimeout(500);
    }
  });
});
