import { test, expect } from '@playwright/test';

test.describe('EcoTrace Calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calculator.html');
  });

  test('calculator form loads', async ({ page }) => {
    const form = page.locator('[data-calculator-form]');
    await expect(form).toBeVisible();
  });

  test('step indicators are present', async ({ page }) => {
    const steps = page.locator('.step-indicator span');
    const count = await steps.count();
    expect(count).toBeGreaterThan(0);
  });

  test('input fields accept numeric values', async ({ page }) => {
    const firstInput = page.locator('[data-calculator-form] input[type="number"]').first();
    if (await firstInput.count() > 0) {
      await firstInput.fill('100');
      await expect(firstInput).toHaveValue('100');
    }
  });

  test('page has proper heading', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/carbon|footprint|calculator/i);
  });
});
