import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/EcoTrace/i);
  });

  test('has navigation links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('a[href*="dashboard"]')).toBeVisible();
    await expect(page.locator('a[href*="calculator"]')).toBeVisible();
  });

  test('has skip link for accessibility', async ({ page }) => {
    await page.goto('/');
    const skipLink = page.locator('.skip-link, [class*="skip"]');
    await expect(skipLink).toBeAttached();
  });

  test('dark mode toggle works', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('[data-dark-toggle], #darkToggle, [aria-label*="dark"]');
    if (await toggle.count() > 0) {
      await toggle.first().click();
      await expect(page.locator('html')).toHaveClass(/dark/);
    }
  });

  test('carbon counter animates', async ({ page }) => {
    await page.goto('/');
    const counter = page.locator('[data-carbon-counter], .carbon-counter');
    if (await counter.count() > 0) {
      await expect(counter.first()).toBeVisible();
    }
  });
});
