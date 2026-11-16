import { AdminOverview } from '@/features/admin/components/AdminOverview';

export const metadata = {
  title: 'Admin Settings & Rates',
};

export default function AdminSettingsPage() {
  return <AdminOverview defaultTab="pricing" />;
}
