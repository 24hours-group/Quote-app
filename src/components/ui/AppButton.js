'use client';

import { Button } from '@mui/material';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner/LoadingSpinner';

export function AppButton({ children, loading = false, disabled, ...props }) {
  return (
    <Button disabled={disabled || loading} {...props}>
      {loading ? <LoadingSpinner label={null} size="sm" /> : children}
    </Button>
  );
}
