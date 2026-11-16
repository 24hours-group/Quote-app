import { expect, test } from '@playwright/test';
import { mockBookingSessionApi } from './helpers/mockBookingSession';

test.beforeEach(async ({ page }) => {
  await mockBookingSessionApi(page);
});

const routes = [
  ['/book', /Are you in a safe place/i],
  ['/booking/RS-TEST-001', /Booking status/i],
  ['/payment/success', /Verifying payment/i],
];

for (const [path, heading] of routes) {
  test(`${path} renders its primary screen`, async ({ page }) => {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible();
  });
}

test('unauthenticated users cannot render admin routes', async ({ page }) => {
  for (const path of ['/admin', '/admin/settings']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/book$/);
    await expect(
      page.getByRole('heading', { name: /Are you in a safe place/i }),
    ).toBeVisible();
  }
});

test('health endpoint returns a structured response', async ({ request }) => {
  const response = await request.get('/api/health');
  const body = await response.json();

  expect(response.ok()).toBe(true);
  expect(body.success).toBe(true);
  expect(body.data.status).toBe('ok');
});
