import { LoadingSpinner } from '@/components/feedback/LoadingSpinner/LoadingSpinner';

export function WizardSkeleton() {
  return (
    <LoadingSpinner
      card
      label="Loading your booking…"
      sublabel="Restoring your session and vehicle roadside details"
    />
  );
}
