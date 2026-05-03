import { expect, test } from '@playwright/test';

test.describe('Web dashboard smoke', () => {
  test('renders home page and can open dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Operate stateful workloads with confidence.' })).toBeVisible();

    await page.getByRole('link', { name: 'Open Dashboard' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Control Plane' })).toBeVisible();
  });
});
