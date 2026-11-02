import { getMockQuoteForService } from '@/features/booking/mock-data/mockQuotes';

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function fetchMockQuote(answers) {
  await wait(650);
  if (answers.mockQuoteFailure) {
    throw new Error('The quote preview could not be loaded.');
  }
  return getMockQuoteForService(answers.serviceType);
}

export async function submitMockPayment() {
  await wait(800);
  return { status: 'succeeded', reference: 'RS-DEMO-2401' };
}
