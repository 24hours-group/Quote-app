import { Suspense } from 'react';
import { Alert, Typography } from '@mui/material';
import { PaymentReturnStatus } from '@/features/payment/components/PaymentReturnStatus';

export const metadata = {
  title: 'Payment verification',
};

export default function PaymentSuccessPage() {
  return (
    <section>
      <Typography component="h1" gutterBottom variant="h4">
        Verifying payment
      </Typography>
      <Suspense
        fallback={<Alert severity="info">Checking payment status…</Alert>}
      >
        <PaymentReturnStatus />
      </Suspense>
    </section>
  );
}
