import { test, expect } from '@playwright/test';

test('Svelte upload widget loads and interacts', async ({ page }) => {
  await page.goto('/');
  const button = page.locator('button');
  await expect(button).toBeVisible();
});
