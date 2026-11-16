import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExistingRequestFields } from '@/features/booking/components/fields/ExistingRequestFields';

describe('existing request fields', () => {
  it('collects and normalizes a customer-provided booking reference', () => {
    const setAnswer = vi.fn();
    render(
      <ExistingRequestFields
        answers={{ bookingReference: '' }}
        errors={{}}
        setAnswer={setAnswer}
      />,
    );

    fireEvent.change(screen.getByLabelText('Booking reference'), {
      target: { value: 'rs-1a2b3c4d5e' },
    });

    expect(setAnswer).toHaveBeenCalledWith('bookingReference', 'RS-1A2B3C4D5E');
    expect(screen.getByText(/agent will verify the booking/i)).toBeVisible();
  });
});
