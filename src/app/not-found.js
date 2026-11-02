import Link from 'next/link';
import { Button, Stack, Typography } from '@mui/material';
import { routes } from '@/config/routes';

export default function NotFound() {
  return (
    <Stack alignItems="flex-start" spacing={2}>
      <Typography component="h1" variant="h3">
        Page not found
      </Typography>
      <Typography color="text.secondary">
        The page you requested does not exist.
      </Typography>
      <Button component={Link} href={routes.book} variant="contained">
        Request roadside service
      </Button>
    </Stack>
  );
}
