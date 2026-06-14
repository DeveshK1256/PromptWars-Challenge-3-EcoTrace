import { test, expect } from '@playwright/test';

const pages = [
  ['/', 'Home'],
  ['/calculator.html', 'Calculator'],
  ['/dashboard.html', 'Dashboard'],
  ['/map.html', 'Map'],
  ['/feed.html', 'Feed'],
  ['/challenges.html', 'Challenges'],
  ['/profile.html', 'Profile'],
  ['/about.html', 'About'],
];

test.describe('Smoke Tests', () => {
  pages.forEach(([url, name]) => {
    test(`${name} page loads without console errors`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await page.goto(url);
      expect(errors).toHaveLength(0);
    });

    test(`${name} page has skip link`, async ({ page }) => {
      await page.goto(url);
      const skipLink = page.locator('.skip-link, a[href="#main-content"]');
      await expect(skipLink).toBeAttached();
    });
  });
});
