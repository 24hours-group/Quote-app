import { expect, test } from '@playwright/test';

async function choose(page, name) {
  await page.getByRole('radio', { name }).click();
}

async function continueFlow(page, label = 'Continue') {
  await page.getByRole('button', { name: label, exact: true }).click();
}

async function reachServiceChoice(page) {
  await page.goto('/book');
  await choose(page, /Yes, I'm safe/i);
  await continueFlow(page);
  await choose(page, /Get help now/i);
  await continueFlow(page);
  await page.getByLabel('Full name').fill('Maria Santos');
  await page.getByLabel('Mobile number').fill('(555) 555-0100');
  await page.getByRole('checkbox', { name: /Text me the invoice/i }).check();
  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Verify code' }).click();
  await continueFlow(page);
  await page
    .getByLabel('Street address and city')
    .fill('1200 N Federal Hwy, Hollywood, FL');
  await page.getByRole('button', { name: /Yes, my vehicle is here/i }).click();
  await continueFlow(page);
  await page.getByLabel('Year').fill('2019');
  await page.getByLabel('Make').fill('Honda');
  await page.getByLabel('Model').fill('CR-V');
  await choose(page, /No Regular passenger vehicle/i);
  await continueFlow(page);
  await expect(
    page.getByRole('heading', { name: /What do you need help with/i }),
  ).toBeVisible();
}

test('new request reaches mock payment without browser pricing authority', async ({
  page,
}) => {
  await reachServiceChoice(page);
  await choose(page, /Jump start Dead battery/i);
  await continueFlow(page);
  await page.getByRole('button', { name: '1' }).click();
  await continueFlow(page, 'See my quote');

  await expect(
    page.getByRole('heading', { name: /Here’s your quote/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/Prototype estimate · not authoritative/i),
  ).toBeVisible();
  await expect(
    page.getByText(/mock total comes from a fixture/i),
  ).toBeVisible();
  await expect(page.getByText('$150.00').last()).toBeVisible();

  await page.getByRole('button', { name: 'Accept and continue' }).click();
  await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible();
  await expect(page.getByText(/No card details are collected/i)).toBeVisible();
});

test('mandatory answers block progress and back navigation preserves answers', async ({
  page,
}) => {
  await page.goto('/book');
  await continueFlow(page);
  await expect(
    page.getByText(/Tell us whether you are in a safe place/i),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Are you in a safe place/i }),
  ).toBeVisible();

  await choose(page, /Yes, I'm safe/i);
  await continueFlow(page);
  await choose(page, /Get help now/i);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(
    page.getByRole('radio', { name: /Yes, I'm safe/i }),
  ).toHaveAttribute('aria-checked', 'true');
});

test('unlisted service branches to the specialist handoff', async ({
  page,
}) => {
  await reachServiceChoice(page);
  await choose(page, /Something else Talk to a specialist/i);
  await continueFlow(page);

  await expect(
    page.getByRole('heading', {
      name: /specialist team handles this service/i,
    }),
  ).toBeVisible();
  await expect(page.getByText(/UNLISTED_SERVICE/i)).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Request a callback/i }),
  ).toBeVisible();
});

test('mobile actions remain sticky and layout has no horizontal overflow', async ({
  page,
}, testInfo) => {
  test.skip(
    !testInfo.project.name.includes('mobile'),
    'Mobile-only layout assertion',
  );
  await page.goto('/book');
  const continueButton = page.getByRole('button', {
    name: 'Continue',
    exact: true,
  });
  await expect(continueButton).toBeVisible();

  const viewport = page.viewportSize();
  const box = await continueButton.boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  const hasOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
});

test('desktop wizard remains centered and readable', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.includes('mobile'),
    'Desktop-only layout assertion',
  );
  await page.goto('/book');
  const heading = page.getByRole('heading', {
    name: /Are you in a safe place/i,
  });
  await expect(heading).toBeVisible();
  const box = await heading.boundingBox();
  expect(box.x).toBeGreaterThan(100);
  expect(box.width).toBeLessThan(760);
});
