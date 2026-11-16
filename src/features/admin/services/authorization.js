import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export const adminRoles = Object.freeze([
  'super_admin',
  'operations_admin',
  'dispatcher',
  'finance',
  'support',
]);

export function hasAdminRole(role) {
  return adminRoles.includes(role);
}

export function canManageTeam(role) {
  return role === 'super_admin';
}

export function canManageCompanySettings(role) {
  return role === 'super_admin';
}

export async function getAuthorizedAdminProfile() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('admin_profiles')
    .select('user_id, role, display_name, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError || !profile?.is_active || !hasAdminRole(profile.role)) {
    return null;
  }
  return profile;
}
