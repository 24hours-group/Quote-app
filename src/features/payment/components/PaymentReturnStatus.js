'use client';

import {
  Alert,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner/LoadingSpinner';
import { usePaymentStatus } from '@/features/payment/hooks/usePaymentStatus';

export function PaymentReturnStatus() {
  const router = useRouter();
  const paymentId = useSearchParams().get('payment_id');
  const status = usePaymentStatus(paymentId ? { paymentId } : null, {
    poll: Boolean(paymentId),
  });

  useEffect(() => {
    const reference = status.data?.booking?.reference;
    if (status.data?.status === 'succeeded' && reference) {
      router.replace(`/booking/${reference}`);
    }
  }, [router, status.data]);

  if (!paymentId) {
    return (
      <Alert severity="warning">
        No payment was selected for verification.
      </Alert>
    );
  }
  if (status.status === 'loading') {
    return (
      <LoadingSpinner
        card
        label="Checking payment status…"
        sublabel="Verifying Stripe confirmation with the server"
      />
    );
  }
  if (status.status === 'error') {
    return (
      <Stack spacing={2}>
        <Alert severity="error">
          {status.error?.message || 'Payment status is unavailable.'}
        </Alert>
        <Button onClick={status.retry} variant="outlined">
          Try again
        </Button>
      </Stack>
    );
  }

  const severity = ['failed', 'cancelled'].includes(status.data.status)
    ? 'error'
    : 'info';
  return (
    <Alert severity={severity}>
      {severity === 'error'
        ? 'The payment was not completed. Return to your booking to try again or pay by phone.'
        : 'Payment is still being confirmed by Stripe. This page will update automatically.'}
    </Alert>
  );
}
