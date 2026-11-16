import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { adminRoles, hasAdminRole } from '@/features/admin/services/authorization';
import { ADMIN_ROLE_DESCRIPTIONS } from '@/features/admin/constants/adminRoles';
import { deliverEmailNotification } from '@/features/notifications/services/resendDeliveryService';

export { ADMIN_ROLE_DESCRIPTIONS };

export async function listAdminTeamMembers() {
  const supabase = createSupabaseAdminClient();

  const [profilesRes, usersRes] = await Promise.all([
    supabase
      .from('admin_profiles')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase.auth.admin.listUsers({ perPage: 200 }),
  ]);

  if (profilesRes.error) {
    throw new Error(`Failed to load admin profiles: ${profilesRes.error.message}`);
  }

  const usersMap = new Map();
  if (usersRes.data?.users) {
    for (const u of usersRes.data.users) {
      usersMap.set(u.id, u);
    }
  }

  return (profilesRes.data || []).map((profile) => {
    const authUser = usersMap.get(profile.user_id);
    return {
      userId: profile.user_id,
      displayName: profile.display_name,
      role: profile.role,
      roleInfo: ADMIN_ROLE_DESCRIPTIONS[profile.role] || {
        label: profile.role.replaceAll('_', ' '),
        description: '',
      },
      isActive: profile.is_active,
      createdAt: profile.created_at,
      email: authUser?.email || 'No email on record',
      emailConfirmed: Boolean(authUser?.email_confirmed_at),
      lastSignInAt: authUser?.last_sign_in_at || null,
      isPendingInvite: !authUser?.last_sign_in_at,
    };
  });
}

export async function inviteAdminTeamMember({
  email,
  displayName,
  role,
  inviterName = 'Townexa Administration',
}) {
  const trimmedEmail = email?.trim().toLowerCase();
  const trimmedName = displayName?.trim();

  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    throw new Error('A valid email address is required.');
  }

  if (!trimmedName || trimmedName.length < 1 || trimmedName.length > 120) {
    throw new Error('Full name must be between 1 and 120 characters.');
  }

  if (!hasAdminRole(role)) {
    throw new Error(`Invalid role. Must be one of: ${adminRoles.join(', ')}`);
  }

  const supabase = createSupabaseAdminClient();

  // Check if a user with this email already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === trimmedEmail,
  );

  let userId;
  let actionLink = null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectTo = `${appUrl}/admin-invite`;

  if (existingUser) {
    userId = existingUser.id;
    // Check if they already have an active admin profile
    const { data: existingProfile } = await supabase
      .from('admin_profiles')
      .select('user_id, is_active, role')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingProfile && existingProfile.is_active) {
      throw new Error(
        `A staff member with email "${trimmedEmail}" is already active with role "${existingProfile.role}".`,
      );
    }

    // Generate link so they can access/accept
    const linkRes = await supabase.auth.admin.generateLink({
      type: 'invite',
      email: trimmedEmail,
      options: {
        redirectTo,
        data: { display_name: trimmedName, role },
      },
    });

    if (linkRes.data?.properties?.action_link) {
      actionLink = linkRes.data.properties.action_link;
    }
  } else {
    // Generate invite link which also creates the user in auth.users
    const linkRes = await supabase.auth.admin.generateLink({
      type: 'invite',
      email: trimmedEmail,
      options: {
        redirectTo,
        data: { display_name: trimmedName, role },
      },
    });

    if (linkRes.error) {
      throw new Error(`Failed to generate invitation: ${linkRes.error.message}`);
    }

    userId = linkRes.data?.user?.id;
    actionLink = linkRes.data?.properties?.action_link || null;
  }

  if (!userId) {
    throw new Error('Could not initialize user account for invitation.');
  }

  // Create or update the admin_profile record
  const { error: profileError } = await supabase.from('admin_profiles').upsert({
    user_id: userId,
    role,
    display_name: trimmedName,
    is_active: true,
  });

  if (profileError) {
    throw new Error(`Failed to save admin profile: ${profileError.message}`);
  }

  // Send invitation email via Resend
  let emailSent = false;
  if (actionLink) {
    try {
      await deliverEmailNotification({
        recipient: trimmedEmail,
        idempotency_key: `admin-invite-${userId}-${Date.now()}`,
        template_key: 'admin.invitation',
        payload: {
          recipientEmail: trimmedEmail,
          displayName: trimmedName,
          role,
          roleLabel: ADMIN_ROLE_DESCRIPTIONS[role]?.label || role,
          actionLink,
          inviterName,
        },
      });
      emailSent = true;
    } catch (deliveryErr) {
      console.warn('Could not dispatch Resend invite email:', deliveryErr.message);
    }
  }

  return {
    userId,
    email: trimmedEmail,
    displayName: trimmedName,
    role,
    actionLink,
    emailSent,
  };
}

export async function updateAdminTeamMember({
  targetUserId,
  currentUserId,
  role,
  isActive,
}) {
  if (targetUserId === currentUserId && isActive === false) {
    throw new Error('You cannot deactivate your own administrative account.');
  }

  if (role && !hasAdminRole(role)) {
    throw new Error(`Invalid role. Must be one of: ${adminRoles.join(', ')}`);
  }

  const supabase = createSupabaseAdminClient();

  const updates = {};
  if (role) updates.role = role;
  if (typeof isActive === 'boolean') updates.is_active = isActive;

  if (Object.keys(updates).length === 0) {
    return { success: true };
  }

  const { error } = await supabase
    .from('admin_profiles')
    .update(updates)
    .eq('user_id', targetUserId);

  if (error) {
    throw new Error(`Failed to update team member: ${error.message}`);
  }

  return { success: true };
}

export async function resendAdminInvitation({
  targetUserId,
  inviterName = 'Townexa Administration',
}) {
  const supabase = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await supabase
    .from('admin_profiles')
    .select('*')
    .eq('user_id', targetUserId)
    .single();

  if (profileError || !profile) {
    throw new Error('Team member profile not found.');
  }

  const { data: userData, error: userError } =
    await supabase.auth.admin.getUserById(targetUserId);

  if (userError || !userData?.user?.email) {
    throw new Error('User account not found.');
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectTo = `${appUrl}/admin-invite`;

  const linkRes = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: userData.user.email,
    options: {
      redirectTo,
      data: { display_name: profile.display_name, role: profile.role },
    },
  });

  if (linkRes.error || !linkRes.data?.properties?.action_link) {
    throw new Error(
      `Failed to generate fresh invitation link: ${linkRes.error?.message || 'Unknown error'}`,
    );
  }

  const actionLink = linkRes.data.properties.action_link;

  let emailSent = false;
  try {
    await deliverEmailNotification({
      recipient: userData.user.email,
      idempotency_key: `admin-resend-${targetUserId}-${Date.now()}`,
      template_key: 'admin.invitation',
      payload: {
        recipientEmail: userData.user.email,
        displayName: profile.display_name,
        role: profile.role,
        roleLabel:
          ADMIN_ROLE_DESCRIPTIONS[profile.role]?.label || profile.role,
        actionLink,
        inviterName,
      },
    });
    emailSent = true;
  } catch (deliveryErr) {
    console.warn('Could not resend email:', deliveryErr.message);
  }

  return {
    actionLink,
    emailSent,
  };
}

