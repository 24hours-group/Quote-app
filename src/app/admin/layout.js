import { AppShell } from '@/components/layout/AppShell';

export default function AdminLayout({ children }) {
  return <AppShell admin>{children}</AppShell>;
}
