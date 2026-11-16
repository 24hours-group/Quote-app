import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseAuthoritativeQuote = vi.fn();
const mockTransitionAuthoritativeQuote = vi.fn();

vi.mock('@/features/pricing/services/quoteClient', () => ({
  transitionAuthoritativeQuote: (...args) =>
    mockTransitionAuthoritativeQuote(...args),
}));

vi.mock('@/features/pricing/hooks/useAuthoritativeQuote', () => ({
  useAuthoritativeQuote: (answers) => mockUseAuthoritativeQuote(answers),
}));

vi.mock('@/features/booking/components/wizard/ScreenLayout', () => ({
  ScreenLayout: ({ title, description, children }) => (
    <section>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </section>
  ),
}));

import { QuoteSummaryScreen } from '@/features/booking/components/screens/QuoteSummaryScreen';

describe('QuoteSummaryScreen error states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a user-friendly error and direct navigation button when contact details are missing', async () => {
    const editScreen = vi.fn();
    const retry = vi.fn();

    mockUseAuthoritativeQuote.mockReturnValue({
      status: 'error',
      quote: null,
      error: {
        message: 'Save your contact details before continuing.',
        details: { blockedScreen: 'S2' },
      },
      retry,
    });

    render(
      <QuoteSummaryScreen
        answers={{ serviceType: 'jump_start' }}
        completeWith={vi.fn()}
        continueWith={vi.fn()}
        editScreen={editScreen}
        setAnswer={vi.fn()}
        setAnswers={vi.fn()}
      />,
    );

    expect(screen.getByText('Contact details needed')).toBeVisible();
    expect(
      screen.getByText(/Please confirm your contact details so we can generate your guaranteed quote/i),
    ).toBeVisible();
    expect(
      screen.getByText('Save your contact details before continuing.'),
    ).toBeVisible();

    const reviewButton = screen.getByRole('button', {
      name: 'Review contact details',
    });
    expect(reviewButton).toBeVisible();
    await userEvent.click(reviewButton);
    expect(editScreen).toHaveBeenCalledWith('S2', 'S7');

    const retryButton = screen.getByRole('button', { name: /Retry quote/i });
    await userEvent.click(retryButton);
    expect(retry).toHaveBeenCalledOnce();
  });

  it('filters out legacy technical transition strings into clean user-facing copy', () => {
    mockUseAuthoritativeQuote.mockReturnValue({
      status: 'error',
      quote: null,
      error: {
        message:
          'The requested booking screen is not reachable from the saved answers. Screen S7 is not reachable (stopped at S2: contactAttached: Save your contact details before continuing.).',
      },
      retry: vi.fn(),
    });

    render(
      <QuoteSummaryScreen
        answers={{ serviceType: 'jump_start' }}
        completeWith={vi.fn()}
        continueWith={vi.fn()}
        editScreen={vi.fn()}
        setAnswer={vi.fn()}
        setAnswers={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Screen S7 is not reachable/i)).toBeNull();
    expect(screen.queryByText(/contactAttached:/i)).toBeNull();
    expect(screen.getByText('Contact details needed')).toBeVisible();
  });

  it('renders a friendly specialist review card and navigation when service cannot be priced online', async () => {
    const editScreen = vi.fn();
    const moveTo = vi.fn();
    const setAnswer = vi.fn();

    mockUseAuthoritativeQuote.mockReturnValue({
      status: 'error',
      quote: null,
      error: {
        code: 'UNLISTED_SERVICE',
        message: 'This service cannot be priced online.',
      },
      retry: vi.fn(),
    });

    render(
      <QuoteSummaryScreen
        answers={{ serviceType: 'other' }}
        completeWith={vi.fn()}
        continueWith={vi.fn()}
        editScreen={editScreen}
        moveTo={moveTo}
        setAnswer={setAnswer}
        setAnswers={vi.fn()}
      />,
    );

    expect(screen.getByText('Specialist review needed')).toBeVisible();
    expect(
      screen.getByText(
        /This service requires specialist review before pricing can be confirmed/i,
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        /Our dispatch specialist will review your request and provide custom pricing over the phone/i,
      ),
    ).toBeVisible();

    // Retry button is hidden to prevent infinite retry loops
    expect(screen.queryByRole('button', { name: /Retry quote/i })).toBeNull();

    const specialistButton = screen.getByRole('button', {
      name: 'Speak with a specialist',
    });
    expect(specialistButton).toBeVisible();
    await userEvent.click(specialistButton);

    expect(setAnswer).toHaveBeenCalledWith('handoffReason', 'UNLISTED_SERVICE');
    expect(setAnswer).toHaveBeenCalledWith('handoffFrom', 'S7');
    expect(moveTo).toHaveBeenCalledWith('R', {
      handoffReason: 'UNLISTED_SERVICE',
      handoffFrom: 'S7',
    });

    const changeServiceButton = screen.getByRole('button', {
      name: 'Choose a different service',
    });
    expect(changeServiceButton).toBeVisible();
    await userEvent.click(changeServiceButton);
    expect(editScreen).toHaveBeenCalledWith('S6', 'S7');
  });
});

describe('QuoteSummaryScreen with accepted quote (going back from payment)', () => {
  const acceptedQuote = {
    id: '10000000-0000-4000-8000-000000000001',
    status: 'accepted',
    period: 'standard',
    pricingVersion: 4,
    validUntil: '2026-11-03T12:30:00.000Z',
    totalPayableNowCents: 27300,
    summary: {
      customer: {
        fullName: 'Jane Doe',
        phoneE164: '+15555550100',
      },
      vehicle: {
        year: 2021,
        make: 'Honda',
        model: 'Civic',
        color: 'Silver',
      },
      pickup: {
        formattedAddress: '123 Main St, Springfield',
      },
      serviceType: 'jump_start',
      payableNowItems: [],
      confirmedAdditionalItems: [],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Accepted Quote", shows "Continue to payment", and does not auto-advance or re-transition', async () => {
    mockUseAuthoritativeQuote.mockReturnValue({
      status: 'success',
      quote: acceptedQuote,
      error: null,
      retry: vi.fn(),
    });

    const continueWith = vi.fn();
    const editScreen = vi.fn();
    const completeWith = vi.fn();

    render(
      <QuoteSummaryScreen
        answers={{
          serviceType: 'jump_start',
          quoteId: acceptedQuote.id,
          quoteStatus: 'accepted',
        }}
        completeWith={completeWith}
        continueWith={continueWith}
        editScreen={editScreen}
        setAnswer={vi.fn()}
        setAnswers={vi.fn()}
      />,
    );

    // Displays status tag for accepted quote
    expect(screen.getByText('Accepted Quote')).toBeVisible();

    // Primary action button is 'Continue to payment' rather than 'Accept and pay'
    const continueButton = screen.getByRole('button', {
      name: 'Continue to payment',
    });
    expect(continueButton).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Accept and pay' }),
    ).toBeNull();

    // Clicking 'Continue to payment' directly proceeds without re-running transition
    await userEvent.click(continueButton);
    expect(mockTransitionAuthoritativeQuote).not.toHaveBeenCalled();
    expect(continueWith).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteId: acceptedQuote.id,
        quoteStatus: 'accepted',
        quoteAction: 'accept',
      }),
    );

    // Clicking an edit detail button calls editScreen without calling transition
    const editButtons = screen.getAllByRole('button', {
      name: 'Edit',
    });
    // Second edit button is Vehicle (Customer is first)
    await userEvent.click(editButtons[1]);
    expect(editScreen).toHaveBeenCalledWith('S5', 'S7');
    expect(mockTransitionAuthoritativeQuote).not.toHaveBeenCalled();

    // Clicking 'No thanks' safely completes without calling transition
    const declineButton = screen.getByRole('button', { name: 'No thanks' });
    await userEvent.click(declineButton);
    expect(completeWith).toHaveBeenCalledWith('declined');
    expect(mockTransitionAuthoritativeQuote).not.toHaveBeenCalled();
  });
});

