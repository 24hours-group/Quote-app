import { Typography } from '@mui/material';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

export function EmptyState({ title, description }) {
  return (
    <SurfaceCard>
      <Typography component="h2" gutterBottom variant="h6">
        {title}
      </Typography>
      <Typography color="text.secondary">{description}</Typography>
    </SurfaceCard>
  );
}
