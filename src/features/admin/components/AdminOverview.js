import { getAuthorizedAdminProfile } from '@/features/admin/services/authorization';
import { getAdminDashboardData } from '@/features/admin/services/adminDashboardService';
import { AdminConsole } from './AdminConsole';

export async function AdminOverview({ defaultTab = 'bookings' }) {
  const profile = await getAuthorizedAdminProfile();
  if (!profile) return null;

  const dashboard = await getAdminDashboardData();

  return (
    <AdminConsole
      initialDashboard={dashboard}
      profile={profile}
      defaultTab={defaultTab}
    />
  );
}
