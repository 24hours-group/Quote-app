import { Skeleton, Stack } from '@mui/material';

export function LoadingState({ rows = 3 }) {
  return (
    <Stack aria-label="Loading content" spacing={2}>
      <Skeleton height={36} variant="rounded" width="45%" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton height={72} key={index} variant="rounded" />
      ))}
    </Stack>
  );
}
