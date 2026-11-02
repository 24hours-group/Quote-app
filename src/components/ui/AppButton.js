'use client';

import { Button, CircularProgress } from '@mui/material';

export function AppButton({ children, loading = false, disabled, ...props }) {
  return (
    <Button disabled={disabled || loading} {...props}>
      {loading ? <CircularProgress color="inherit" size={20} /> : children}
    </Button>
  );
}
