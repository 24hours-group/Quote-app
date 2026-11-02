import { Card, CardContent } from '@mui/material';

export function SurfaceCard({ children, ...props }) {
  return (
    <Card variant="outlined" {...props}>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
