import { List, ListItem, ListItemText, Typography } from '@mui/material';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { applicationConfig } from '@/config/application';

export const metadata = {
  title: 'Admin settings',
};

export default function AdminSettingsPage() {
  const settings = [
    ['Currency', applicationConfig.currency],
    ['Locale', applicationConfig.locale],
    ['Country', applicationConfig.country.name],
    ['Timezone', applicationConfig.timezone],
    ['Availability', applicationConfig.serviceAvailability.schedule],
  ];

  return (
    <section>
      <Typography component="h1" gutterBottom variant="h4">
        Application settings
      </Typography>
      <Typography color="text.secondary" paragraph>
        These deployment defaults are centralized in
        `src/config/application.js`. Editing and persistence will be implemented
        in a later unit.
      </Typography>
      <SurfaceCard>
        <List disablePadding>
          {settings.map(([label, value]) => (
            <ListItem divider key={label}>
              <ListItemText primary={label} secondary={value} />
            </ListItem>
          ))}
        </List>
      </SurfaceCard>
    </section>
  );
}
