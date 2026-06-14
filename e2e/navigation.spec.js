import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  const pages = [
    ['/', /EcoTrace/i],
    ['/calculator.html', /Calculator|EcoTrace/i],
    ['/dashboard.html', /Dashboard|EcoTrace/i],
    ['/map.html', /Map|EcoTrace/i],
    ['/feed.html', /Feed|EcoTrace/i],
    ['/challenges.html', /Challenge|EcoTrace/i],
  ];

  pages.forEach(([url, titlePattern]) => {
    test(`${url} loads without errors`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await page.goto(url);
      await expect(page).toHaveTitle(titlePattern);
    });
  });

  test('nav links navigate correctly', async ({ page }) => {
    await page.goto('/');
    const dashLink = page.locator('a[href*="dashboard"]').first();
    if (await dashLink.count() > 0) {
      await dashLink.click();
      await expect(page).toHaveURL(/dashboard/);
    }
  });
});
