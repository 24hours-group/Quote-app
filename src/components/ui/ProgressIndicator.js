'use client';

import { LinearProgress, Stack, Typography } from '@mui/material';

export function ProgressIndicator({ currentStep, totalSteps, label }) {
  const value = Math.min(100, Math.max(0, (currentStep / totalSteps) * 100));

  return (
    <Stack spacing={1} aria-label={label || 'Progress'}>
      <Typography color="text.secondary" variant="body2">
        {label || `Step ${currentStep} of ${totalSteps}`}
      </Typography>
      <LinearProgress value={value} variant="determinate" />
    </Stack>
  );
}
