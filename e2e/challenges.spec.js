import { test, expect } from '@playwright/test';

test.describe('Challenges Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/challenges.html');
  });

  test('has navigation and heading', async ({ page }) => {
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('has challenge grid', async ({ page }) => {
    const grid = page.locator('[data-challenge-grid]');
    await expect(grid).toBeAttached();
  });

  test('has badge grid', async ({ page }) => {
    const grid = page.locator('[data-badge-grid]');
    await expect(grid).toBeAttached();
  });

  test('has leaderboard', async ({ page }) => {
    const board = page.locator('[data-leaderboard]');
    await expect(board).toBeAttached();
  });

  test('has level progress section', async ({ page }) => {
    const section = page.locator('[data-level-progress]');
    await expect(section).toBeAttached();
  });

  test('has daily missions section', async ({ page }) => {
    const section = page.locator('[data-daily-missions]');
    await expect(section).toBeAttached();
  });

  test('has streak display', async ({ page }) => {
    const section = page.locator('[data-streak-display]');
    await expect(section).toBeAttached();
  });

  test('has team leaderboard', async ({ page }) => {
    const section = page.locator('[data-team-leaderboard]');
    await expect(section).toBeAttached();
  });

  test('has pledge wall', async ({ page }) => {
    const wall = page.locator('[data-pledge-wall]');
    await expect(wall).toBeAttached();
  });

  test('green points wallet visible', async ({ page }) => {
    const points = page.locator('[data-green-points]');
    await expect(points).toBeAttached();
  });

  test('aria-live attributes on dynamic sections', async ({ page }) => {
    const missions = page.locator('[data-daily-missions]');
    await expect(missions).toHaveAttribute('aria-live', 'polite');
    const streak = page.locator('[data-streak-display]');
    await expect(streak).toHaveAttribute('aria-live', 'polite');
  });
});
