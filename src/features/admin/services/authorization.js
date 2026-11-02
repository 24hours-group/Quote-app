import 'server-only';

export const adminRoles = Object.freeze(['admin']);

export function hasAdminRole(role) {
  return adminRoles.includes(role);
}
