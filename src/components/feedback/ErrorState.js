'use client';

import { Alert, AlertTitle, Stack } from '@mui/material';
import { AppButton } from '@/components/ui/AppButton';

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}) {
  return (
    <Stack spacing={2}>
      <Alert severity="error">
        <AlertTitle>{title}</AlertTitle>
        {message || 'Please try again.'}
      </Alert>
      {onRetry ? (
        <AppButton onClick={onRetry} variant="outlined">
          Try again
        </AppButton>
      ) : null}
    </Stack>
  );
}
