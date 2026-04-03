import { test, expect } from '@playwright/test';

test('unauthenticated user is sent to Login', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Welcome back')).toBeVisible();
});

