import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { getAuthorizedAdminProfile } from '@/features/admin/services/authorization';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  const profile = await getAuthorizedAdminProfile();
  if (!profile) redirect('/admin-login');
  return <AppShell admin>{children}</AppShell>;
}
