import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { simulatePayment } = vi.hoisted(() => ({
  simulatePayment: vi.fn(),
}));
vi.mock('@/features/payment/services/paymentClient', () => ({
  simulatePayment,
}));

import { SimulatedPaymentForm } from '@/features/payment/components/SimulatedPaymentForm';

describe('local payment form', () => {
  beforeEach(() => {
    simulatePayment.mockReset();
  });

  it('submits a success outcome when payment is completed', async () => {
    simulatePayment.mockResolvedValue({ status: 'succeeded' });
    const onSimulationComplete = vi.fn();
    render(
      <SimulatedPaymentForm
        onSimulationComplete={onSimulationComplete}
        paymentId="10000000-0000-4000-8000-000000000001"
      />,
    );

    expect(
      screen.queryByRole('button', { name: /decline payment/i }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Complete payment' }),
    );

    expect(simulatePayment).toHaveBeenCalledWith(
      '10000000-0000-4000-8000-000000000001',
      'success',
    );
    expect(onSimulationComplete).toHaveBeenCalledOnce();
  });

  it('shows an actionable error and allows the customer to retry', async () => {
    simulatePayment.mockRejectedValueOnce(new Error('Provider unavailable'));
    render(
      <SimulatedPaymentForm
        onSimulationComplete={vi.fn()}
        paymentId="10000000-0000-4000-8000-000000000001"
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Complete payment' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /review your details or use another payment method/i,
    );
    expect(
      screen.getByRole('button', { name: 'Complete payment' }),
    ).toBeEnabled();
  });
});
