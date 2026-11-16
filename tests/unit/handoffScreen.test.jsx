import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const submit = vi.fn();
vi.mock('@/features/booking/components/wizard/ScreenLayout', () => ({
  ScreenLayout: ({ title, description, children }) => (
    <section>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </section>
  ),
}));
vi.mock('@/features/handoff/hooks/useHandoffLead', () => ({
  useHandoffLead: () => ({
    error: null,
    isSubmitting: false,
    status: 'idle',
    submit,
  }),
}));

import { HandoffScreen } from '@/features/handoff/components/HandoffScreen';

beforeEach(() => {
  submit.mockReset();
  submit.mockResolvedValue({ supportPhoneE164: '+15550102020' });
});

describe('R hand-off screen', () => {
  it('persists a callback before completing the wizard', async () => {
    const completeWith = vi.fn();
    const saveCurrentDraft = vi.fn().mockResolvedValue(undefined);
    render(
      <HandoffScreen
        answers={{
          contactAttached: true,
          fullName: 'Maria Santos',
          handoffReason: 'PAY_BY_PHONE',
          mobileNumber: '(212) 555-0100',
        }}
        completeWith={completeWith}
        editScreen={vi.fn()}
        saveCurrentDraft={saveCurrentDraft}
      />,
    );
    expect(
      screen.getByText(/does not mark your quote or booking as paid/i),
    ).toBeVisible();
    expect(screen.getByText('Payment by phone')).toBeVisible();
    expect(screen.queryByText('PAY_BY_PHONE')).toBeNull();
    await userEvent.click(
      screen.getByRole('button', { name: 'Request a callback' }),
    );
    expect(saveCurrentDraft).toHaveBeenCalledOnce();
    expect(saveCurrentDraft.mock.invocationCallOrder[0]).toBeLessThan(
      submit.mock.invocationCallOrder[0],
    );
    expect(submit).toHaveBeenCalledWith({
      reasonCode: 'PAY_BY_PHONE',
      action: 'request_callback',
    });
    expect(completeWith).toHaveBeenCalledWith('request_callback');
  });

  it('requires contact details before requesting a callback', async () => {
    const editScreen = vi.fn();
    render(
      <HandoffScreen
        answers={{ handoffReason: 'USER_REQUEST' }}
        completeWith={vi.fn()}
        editScreen={editScreen}
        saveCurrentDraft={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Request a callback' }),
    ).toBeDisabled();
    expect(screen.getByText(/name and phone number/i)).toBeVisible();
    await userEvent.click(
      screen.getByRole('button', { name: 'Add contact details' }),
    );
    expect(editScreen).toHaveBeenCalledWith('S2', 'R');
    expect(submit).not.toHaveBeenCalled();
  });

  it('keeps winch specialist hand-offs callback-only', () => {
    render(
      <HandoffScreen
        answers={{ handoffReason: 'WINCH_SPECIALIST' }}
        completeWith={vi.fn()}
        saveCurrentDraft={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Request a callback' }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Call now' })).toBeNull();
    expect(screen.getByText(/does not confirm a price/i)).toBeVisible();
  });

  it('shows explicit emergency guidance for unsafe customers', () => {
    render(
      <HandoffScreen
        answers={{ handoffReason: 'USER_REQUEST', isSafe: false }}
        completeWith={vi.fn()}
        saveCurrentDraft={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      /roadside assistance is not an emergency-response service/i,
    );
    expect(screen.getByRole('link', { name: 'Call 911' })).toHaveAttribute(
      'href',
      'tel:911',
    );
  });

  it('does not promise a cancellation refund', () => {
    render(
      <HandoffScreen
        answers={{ handoffReason: 'CANCEL_JOB' }}
        completeWith={vi.fn()}
        saveCurrentDraft={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/review cancellation and refund options/i),
    ).toBeVisible();
    expect(screen.getByText(/does not cancel the booking/i)).toBeVisible();
  });
});
