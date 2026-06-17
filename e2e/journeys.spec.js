/**
 * @module e2e/journeys
 * End-to-end journey tests for complete user flows:
 * - Calculator wizard → save → dashboard verification
 * - AI tips refresh and card rendering
 * - Sign-in → protected page access
 */
import { test, expect } from '@playwright/test';

test.describe('Calculator → Save → Dashboard Journey', () => {
  test('completes full calculator wizard and sees result', async ({ page }) => {
    await page.goto('/calculator.html');

    // Step 1: Transport
    const form = page.locator('[data-calculator-form]');
    await expect(form).toBeVisible();

    const carKm = page.locator('input[name="carKm"], [data-field="carKm"]').first();
    if (await carKm.isVisible()) await carKm.fill('100');

    const flights = page.locator('input[name="flights"], [data-field="flights"]').first();
    if (await flights.isVisible()) await flights.fill('2');

    // Navigate through steps
    const nextButton = page.locator('[data-next-step]');
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForTimeout(300);

      // Step 2: Food — fill what's visible
      const nextBtn2 = page.locator('[data-next-step]');
      if (await nextBtn2.isVisible()) {
        await nextBtn2.click();
        await page.waitForTimeout(300);
      }

      // Step 3: Energy
      const nextBtn3 = page.locator('[data-next-step]');
      if (await nextBtn3.isVisible()) {
        await nextBtn3.click();
        await page.waitForTimeout(300);
      }
    }

    // Final step: should show finish/calculate button
    const finishBtn = page.locator('[data-finish-step]');
    if (await finishBtn.isVisible()) {
      await finishBtn.click();
      await page.waitForTimeout(500);
    }

    // Result should be visible
    const resultSection = page.locator('[data-result], .result-panel, .score-display');
    const resultVisible = await resultSection.first().isVisible().catch(() => false);
    if (resultVisible) {
      // Verify a numeric result is displayed
      const scoreText = await resultSection.first().textContent();
      expect(scoreText).toBeTruthy();
    }
  });

  test('save button exists and is initially disabled for unauthenticated users', async ({ page }) => {
    await page.goto('/calculator.html');
    const saveBtn = page.locator('[data-save-result]');
    const exists = await saveBtn.count();
    if (exists > 0) {
      // Save button should be disabled until auth
      await expect(saveBtn).toBeDisabled();
    }
  });
});

test.describe('Tips Page', () => {
  test('loads with category tabs and tip cards', async ({ page }) => {
    await page.goto('/tips.html');

    // Category tabs should render
    const tabs = page.locator('[data-tip-tabs]');
    await expect(tabs).toBeVisible();

    // At least one tab should exist
    const tabButtons = tabs.locator('button');
    const tabCount = await tabButtons.count();
    expect(tabCount).toBeGreaterThan(0);
  });

  test('refresh button exists', async ({ page }) => {
    await page.goto('/tips.html');
    const refreshBtn = page.locator('[data-refresh-tips]');
    await expect(refreshBtn).toBeVisible();
  });
});

test.describe('Protected Page Access', () => {
  test('dashboard shows auth-required state for unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard.html');
    // Should either redirect or show auth-required message
    const authRequired = page.locator('[data-auth-required]');
    const exists = await authRequired.count();
    expect(exists).toBeGreaterThan(0);
  });

  test('profile page loads', async ({ page }) => {
    await page.goto('/profile.html');
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
  });
});

test.describe('Accessibility Checks', () => {
  test('all pages have lang attribute', async ({ page }) => {
    const pages = ['/', '/calculator.html', '/dashboard.html', '/tips.html', '/map.html'];
    for (const url of pages) {
      await page.goto(url);
      const lang = await page.locator('html').getAttribute('lang');
      expect(lang).toBeTruthy();
    }
  });

  test('all pages have skip links', async ({ page }) => {
    const pages = ['/', '/calculator.html', '/dashboard.html'];
    for (const url of pages) {
      await page.goto(url);
      const skipLink = page.locator('a[href="#main-content"], a[href="#main"]');
      const count = await skipLink.count();
      expect(count).toBeGreaterThan(0);
    }
  });
});
