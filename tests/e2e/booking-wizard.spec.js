import { expect, test } from '@playwright/test';
import { mockBookingSessionApi } from './helpers/mockBookingSession';

test.beforeEach(async ({ page }) => {
  await mockBookingSessionApi(page);
});

async function choose(page, name) {
  await page.getByRole('radio', { name }).click();
}

async function continueFlow(page, label = 'Continue') {
  await page.getByRole('button', { name: label, exact: true }).click();
}

async function reachLocationScreen(page) {
  await page.goto('/book');
  await choose(page, /Yes, I'm safe/i);
  await continueFlow(page);
  await choose(page, /Get help now/i);
  await continueFlow(page);
  await page.getByLabel('Full name').fill('Maria Santos');
  await page.getByLabel('Receipt email').fill('maria@example.com');
  await page.getByLabel('US phone number').fill('(555) 555-0100');
  await expect(
    page.getByText(/validate US phone-number formatting only/i),
  ).toBeVisible();
  await continueFlow(page);
  await expect(
    page.getByRole('heading', { name: /Where is your vehicle/i }),
  ).toBeVisible();
}

async function selectAndConfirmLocation(page) {
  await page.getByLabel('Street address and city').fill('1200 N Federal Hwy');
  await page
    .getByRole('button', { name: /1200 N Federal Hwy, Hollywood, FL/i })
    .click();
  await expect(
    page.getByRole('application', {
      name: /Interactive vehicle location map/i,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Yes, my vehicle is here/i }).click();
  await expect(
    page.getByText('Location confirmed', { exact: true }),
  ).toBeVisible();
}

async function reachServiceChoice(page) {
  await reachLocationScreen(page);
  await selectAndConfirmLocation(page);
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

async function reachJumpStartQuote(page) {
  await reachServiceChoice(page);
  await choose(page, /Jump start Dead battery/i);
  await continueFlow(page);
  await page.getByRole('button', { name: '1' }).click();
  await continueFlow(page, 'See my quote');
  await expect(
    page.getByRole('heading', { name: /Here’s your quote/i }),
  ).toBeVisible();
}

test('S4 requires reconfirmation after the map marker moves', async ({
  page,
}) => {
  await reachLocationScreen(page);
  await selectAndConfirmLocation(page);

  await page.evaluate(() =>
    window.__triggerLocationMarkerDrag(26.022, -80.143),
  );

  await expect(
    page.getByText('Location confirmed', { exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole('button', { name: /Yes, my vehicle is here/i }),
  ).toBeEnabled();
  await continueFlow(page);
  await expect(
    page.getByText(/Confirm the updated address and map pin/i),
  ).toBeVisible();

  await page.getByRole('button', { name: /Yes, my vehicle is here/i }).click();
  await continueFlow(page);
  await expect(
    page.getByRole('heading', { name: /What are you driving/i }),
  ).toBeVisible();
});

test('tow flow calculates and displays a server route', async ({ page }) => {
  await reachServiceChoice(page);
  await choose(page, /Tow Move my vehicle/i);
  await continueFlow(page);

  await expect(
    page.getByRole('heading', { name: /Where should we tow it/i }),
  ).toBeVisible();
  await page.getByLabel('Drop-off address').fill('Joe Auto Miami');
  await page
    .getByRole('button', { name: /1000 Biscayne Blvd, Miami/i })
    .click();
  await expect(
    page.getByRole('application', { name: /Tow pickup, drop-off/i }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Confirm this drop-off/i }).click();
  await continueFlow(page);

  await expect(page.getByText('12.5 driving miles')).toBeVisible();
  await expect(
    page.getByText(/25 min estimated · 13 billable miles/i),
  ).toBeVisible();
  await expect(
    page.getByRole('application', { name: /driving route map/i }),
  ).toBeVisible();
  await choose(page, /^Yes$/i);
  await continueFlow(page, 'See my quote');
  await expect(
    page.getByRole('heading', { name: /Here’s your quote/i }),
  ).toBeVisible();
});

test('new request uses an authoritative quote before payment', async ({
  page,
}) => {
  await reachJumpStartQuote(page);

  await expect(page.getByText(/Pricing v2 · day rate/i)).toBeVisible();
  await expect(page.getByText(/Valid until .*30 minutes/i)).toBeVisible();
  await expect(page.getByText(/Maria Santos · \+15555550100/i)).toBeVisible();
  await expect(page.getByText(/2019 Honda CR-V/i)).toBeVisible();
  await expect(page.getByText(/server-stored pricing snapshot/i)).toBeVisible();
  await expect(page.getByText('$150.00').last()).toBeVisible();

  await page.getByRole('button', { name: 'Accept and pay' }).click();
  await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible();
  await expect(
    page.getByText(/booking is confirmed only after payment is verified/i),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Pay by phone instead' }),
  ).toBeVisible();
  await expect(page.getByText(/demo payment/i)).toHaveCount(0);
});

test('quote actions persist decline and pay-by-phone transitions', async ({
  page,
}) => {
  const quoteTransitions = [];
  page.on('request', (request) => {
    if (
      request.method() === 'PATCH' &&
      new URL(request.url()).pathname === '/api/booking/quote'
    ) {
      quoteTransitions.push(request.postDataJSON()?.action);
    }
  });
  await reachJumpStartQuote(page);
  await page.getByRole('button', { name: 'Pay by phone instead' }).click();
  await expect(
    page.getByRole('heading', {
      name: /agent can take your payment by phone/i,
    }),
  ).toBeVisible();
  expect(quoteTransitions).not.toContain('decline');

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: /Here’s your quote/i }),
  ).toBeVisible();
});

test('editing a priced service supersedes and regenerates the quote', async ({
  page,
}) => {
  await reachJumpStartQuote(page);
  const originalQuote = await page.getByText(/Quote \d{8}/).textContent();
  await page
    .getByText('Service', { exact: true })
    .locator('..')
    .getByRole('button', { name: 'Edit' })
    .click();

  await expect(
    page.getByRole('heading', { name: /What do you need help with/i }),
  ).toBeVisible();
  await choose(page, /Locked out Keys inside/i);
  await continueFlow(page);
  await choose(page, /^No$/i);
  await continueFlow(page, 'See my quote');

  await expect(page.getByText('Lockout', { exact: true })).toBeVisible();
  await expect(page.getByText(/Quote \d{8}/)).not.toHaveText(originalQuote);
});

test('no thanks stores a declined quote before completing', async ({
  page,
}) => {
  await reachJumpStartQuote(page);
  await page.getByRole('button', { name: 'No thanks' }).click();
  await expect(
    page.getByRole('heading', { name: /Thanks for checking with us/i }),
  ).toBeVisible();
  await expect(page.getByText(/saved as declined/i)).toBeVisible();
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

test('invalid US phone formatting blocks contact progression', async ({
  page,
}) => {
  await page.goto('/book');
  await choose(page, /Yes, I'm safe/i);
  await continueFlow(page);
  await choose(page, /Get help now/i);
  await continueFlow(page);
  await page.getByLabel('Full name').fill('Maria Santos');
  await page.getByLabel('Receipt email').fill('maria@example.com');
  await page.getByLabel('US phone number').fill('123-456-7890');
  await continueFlow(page);

  await expect(page.getByText('Enter a valid US phone number.')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /How can we reach you/i }),
  ).toBeVisible();
});

test('refresh restores the server-backed wizard screen and answers', async ({
  page,
}) => {
  await page.goto('/book');
  await choose(page, /Yes, I'm safe/i);
  await continueFlow(page);
  await choose(page, /Get help now/i);
  await expect(page.getByText('Progress saved')).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole('heading', { name: /What can we help you with/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('radio', { name: /Get help now/i }),
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
