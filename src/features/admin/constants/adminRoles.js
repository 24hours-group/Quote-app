export const ADMIN_ROLE_DESCRIPTIONS = {
  super_admin: {
    label: 'Super Admin',
    description: 'Full access to all operations, pricing controls, and team management.',
    badgeClass: 'badgeSuperAdmin',
  },
  operations_admin: {
    label: 'Operations Admin',
    description: 'Manage active dispatches, bookings, callback leads, and driver triage.',
    badgeClass: 'badgeOps',
  },
  dispatcher: {
    label: 'Dispatcher',
    description: 'View trip locations, assign drivers, and update dispatch status.',
    badgeClass: 'badgeDispatcher',
  },
  finance: {
    label: 'Finance & Billing',
    description: 'View booking revenues, payments, Stripe logs, and rate parameters.',
    badgeClass: 'badgeFinance',
  },
  support: {
    label: 'Customer Support',
    description: 'Manage incoming callback leads and review customer bookings.',
    badgeClass: 'badgeSupport',
  },
};

