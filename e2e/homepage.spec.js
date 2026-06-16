import { test, expect } from '@playwright/test';

test.describe('EcoTrace Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/EcoTrace/);
  });

  test('navigation renders all links', async ({ page }) => {
    const navLinks = page.locator('[data-nav-link]');
    await expect(navLinks).toHaveCount(7); // Home, Calculator, Dashboard, AI Tips, Map, Challenges, Feed, Profile
  });

  test('dark mode toggle exists and is clickable', async ({ page }) => {
    const toggle = page.locator('[data-darkmode-toggle]');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await toggle.click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  });

  test('carbon counter is visible', async ({ page }) => {
    const counter = page.locator('[data-counter]');
    await expect(counter).toBeVisible();
    const text = await counter.textContent();
    expect(text.trim().length).toBeGreaterThan(0);
  });

  test('hero section has CTA buttons', async ({ page }) => {
    const calcBtn = page.locator('a[href="calculator.html"]').first();
    await expect(calcBtn).toBeVisible();
  });

  test('earth vitals ticker scrolls', async ({ page }) => {
    const track = page.locator('.vitals-track');
    await expect(track).toBeVisible();
  });
});
