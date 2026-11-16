import { LoadingSpinner } from '@/components/feedback/LoadingSpinner/LoadingSpinner';

export function LoadingState({
  message = 'Loading…',
  sublabel = 'Preparing Townexa Roadside Assistance…',
  fullPage = true,
  card = false,
}) {
  return (
    <LoadingSpinner
      fullPage={fullPage}
      card={card}
      label={message}
      sublabel={sublabel}
    />
  );
}
