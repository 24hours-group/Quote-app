import { Alert, Typography } from '@mui/material';

export const metadata = {
  title: 'Payment return',
};

export default function PaymentSuccessPage() {
  return (
    <section>
      <Typography component="h1" gutterBottom variant="h4">
        Payment return
      </Typography>
      <Alert severity="info">
        Stripe checkout and payment verification are not implemented in this
        foundation release. Future payment status will be verified server-side;
        this return URL will not be treated as proof of payment.
      </Alert>
    </section>
  );
}
