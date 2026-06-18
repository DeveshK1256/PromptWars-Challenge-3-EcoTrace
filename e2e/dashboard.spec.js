import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard.html');
  });

  test('has correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/Dashboard|EcoTrace/);
  });

  test('has navigation bar', async ({ page }) => {
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('has eco activity heatmap section', async ({ page }) => {
    const section = page.locator('[data-eco-heatmap]');
    await expect(section).toBeAttached();
  });

  test('has offset visualizer section', async ({ page }) => {
    const section = page.locator('[data-offset-viz]');
    await expect(section).toBeAttached();
  });

  test('has AI forecast section', async ({ page }) => {
    const section = page.locator('[data-forecast-panel]');
    await expect(section).toBeAttached();
  });

  test('has impact equivalences section', async ({ page }) => {
    const section = page.locator('[data-dashboard-equivalences]');
    await expect(section).toBeAttached();
  });

  test('has footprint comparison section', async ({ page }) => {
    const section = page.locator('[data-footprint-compare]');
    await expect(section).toBeAttached();
  });

  test('has download scorecard button', async ({ page }) => {
    const btn = page.locator('[data-share-card]');
    await expect(btn).toBeAttached();
    await expect(btn).toContainText('Download');
  });

  test('dark mode toggle works', async ({ page }) => {
    const toggle = page.locator('[data-darkmode-toggle]');
    await toggle.click();
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('dark');
  });

  test('aria-live attributes present on dynamic sections', async ({ page }) => {
    const heatmap = page.locator('[data-eco-heatmap]');
    await expect(heatmap).toHaveAttribute('aria-live', 'polite');
    const offset = page.locator('[data-offset-viz]');
    await expect(offset).toHaveAttribute('aria-live', 'polite');
  });
});
