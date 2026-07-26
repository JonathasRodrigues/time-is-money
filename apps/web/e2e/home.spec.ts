import { test, expect } from '@playwright/test';

test('home renders brand', async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_BASE_URL && !process.env.CI, 'Requires running app');
  await page.goto('/');
  await expect(page.getByText('Time is Money').first()).toBeVisible();
});
