'use client';

import { ErrorState } from '@/components/feedback/ErrorState';

export default function ErrorBoundary({ reset }) {
  return (
    <ErrorState
      message="The page could not be loaded safely."
      onRetry={reset}
    />
  );
}
