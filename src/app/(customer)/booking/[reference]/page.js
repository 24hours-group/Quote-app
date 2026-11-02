import { Chip, Stack, Typography } from '@mui/material';
import { EmptyState } from '@/components/feedback/EmptyState';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

export const metadata = {
  title: 'Booking status',
};

export default function BookingStatusPage({ params }) {
  return (
    <Stack spacing={3}>
      <div>
        <Typography component="h1" gutterBottom variant="h4">
          Booking status
        </Typography>
        <Chip label={`Reference: ${params.reference}`} variant="outlined" />
      </div>
      <SurfaceCard>
        <Typography color="text.secondary">
          Secure booking lookup will be connected to Supabase Auth and the
          booking service in a later unit. A reference alone will never grant
          access to customer data.
        </Typography>
      </SurfaceCard>
      <EmptyState
        description="No booking data is available in the architecture-only release."
        title="Status unavailable"
      />
    </Stack>
  );
}
