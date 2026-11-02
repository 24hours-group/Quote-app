import { expect, test } from '@playwright/test';

const routes = [
  ['/book', /Are you in a safe place/i],
  ['/booking/RS-TEST-001', /Booking status/i],
  ['/payment/success', /Payment return/i],
  ['/admin', /^Admin$/i],
  ['/admin/settings', /Application settings/i],
];

for (const [path, heading] of routes) {
  test(`${path} renders its primary screen`, async ({ page }) => {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible();
  });
}

test('health endpoint returns a structured response', async ({ request }) => {
  const response = await request.get('/api/health');
  const body = await response.json();

  expect(response.ok()).toBe(true);
  expect(body.success).toBe(true);
  expect(body.data.status).toBe('ok');
});
