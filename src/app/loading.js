import { LoadingSpinner } from '@/components/feedback/LoadingSpinner/LoadingSpinner';

export default function Loading() {
  return (
    <LoadingSpinner
      fullPage
      label="Loading Townexa…"
      sublabel="Preparing your roadside assistance experience"
    />
  );
}
