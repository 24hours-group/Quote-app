'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  RefreshCw,
  ShieldCheck,
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { FormattedDate } from '../FormattedDate/FormattedDate';
import { InviteMemberModal } from './InviteMemberModal';
import { ADMIN_ROLE_DESCRIPTIONS } from '@/features/admin/constants/adminRoles';
import styles from './TeamManagementList.module.css';

export function TeamManagementList({ currentProfile }) {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const fetchTeam = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/team');
      const data = await res.json();
      if (res.ok && data.success) {
        setTeam(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load team members:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  async function handleRoleChange(userId, newRole) {
    if (actionLoadingId) return;
    setActionLoadingId(userId);
    try {
      const res = await fetch(`/api/admin/team/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTeam((prev) =>
          prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m)),
        );
        showToast('Staff role updated successfully');
      } else {
        showToast(data.error || 'Failed to update role', true);
      }
    } catch {
      showToast('Network error updating role', true);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleToggleActive(userId, currentActive) {
    if (actionLoadingId) return;
    setActionLoadingId(userId);
    try {
      const res = await fetch(`/api/admin/team/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTeam((prev) =>
          prev.map((m) =>
            m.userId === userId ? { ...m, isActive: !currentActive } : m,
          ),
        );
        showToast(
          currentActive ? 'Account deactivated' : 'Account reactivated',
        );
      } else {
        showToast(data.error || 'Failed to update status', true);
      }
    } catch {
      showToast('Network error updating status', true);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleResendInvite(userId) {
    if (actionLoadingId) return;
    setActionLoadingId(userId);
    try {
      const res = await fetch(`/api/admin/team/${userId}/resend`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Fresh invitation sent to staff email');
      } else {
        showToast(data.error || 'Failed to resend invite', true);
      }
    } catch {
      showToast('Network error resending invite', true);
    } finally {
      setActionLoadingId(null);
    }
  }

  function showToast(message, isError = false) {
    setToastMessage({ message, isError });
    setTimeout(() => setToastMessage(null), 3500);
  }

  const filteredTeam = team.filter((member) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      member.displayName?.toLowerCase().includes(q) ||
      member.email?.toLowerCase().includes(q) ||
      member.role?.toLowerCase().includes(q)
    );
  });

  const isSuperAdmin = currentProfile?.role === 'super_admin';

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>Admin Team & Staff</h2>
          <p className={styles.subtitle}>
            Manage dispatcher, operations, finance, and administrator accounts
            for Townexa Operations Console.
          </p>
        </div>

        <div className={styles.topActions}>
          <button
            type="button"
            onClick={fetchTeam}
            className={styles.refreshButton}
            title="Refresh team list"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={styles.inviteButton}
          >
            <UserPlus size={14} />
            Invite Team Member
          </button>
        </div>
      </div>

      <div className={styles.filterBar}>
        <input
          type="search"
          placeholder="Filter team by name, email, or role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
        {toastMessage ? (
          <span
            className={
              toastMessage.isError
                ? 'text-xs font-bold text-rose-600'
                : 'text-xs font-bold text-emerald-600'
            }
          >
            {toastMessage.message}
          </span>
        ) : null}
      </div>

      {loading && team.length === 0 ? (
        <div className={styles.loadingState}>
          <RefreshCw size={20} className="animate-spin text-blue-600" />
          <span>Loading admin team…</span>
        </div>
      ) : filteredTeam.length === 0 ? (
        <div className={styles.emptyState}>
          No staff members match your search criteria.
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Staff Member</th>
                <th className={styles.th}>Assigned Role</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Date Added</th>
                <th className={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeam.map((member) => {
                const initials = member.displayName
                  ? member.displayName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()
                  : 'ST';

                const roleMeta =
                  ADMIN_ROLE_DESCRIPTIONS[member.role] || {};
                const badgeClass =
                  styles[roleMeta.badgeClass] || styles.badgeDispatcher;
                const isSelf = member.userId === currentProfile?.user_id;

                return (
                  <tr key={member.userId} className={styles.tr}>
                    <td className={styles.td}>
                      <div className={styles.userCell}>
                        <div className={styles.avatar}>{initials}</div>
                        <div className={styles.userInfo}>
                          <span className={styles.userName}>
                            {member.displayName}
                            {isSelf ? ' (You)' : ''}
                          </span>
                          <span className={styles.userEmail}>{member.email}</span>
                        </div>
                      </div>
                    </td>

                    <td className={styles.td}>
                      {isSuperAdmin && !isSelf ? (
                        <select
                          value={member.role}
                          disabled={actionLoadingId === member.userId}
                          onChange={(e) =>
                            handleRoleChange(member.userId, e.target.value)
                          }
                          className={styles.roleSelect}
                        >
                          {Object.entries(ADMIN_ROLE_DESCRIPTIONS).map(
                            ([key, val]) => (
                              <option key={key} value={key}>
                                {val.label}
                              </option>
                            ),
                          )}
                        </select>
                      ) : (
                        <span className={badgeClass}>
                          <ShieldCheck size={12} />
                          {roleMeta.label || member.role}
                        </span>
                      )}
                    </td>

                    <td className={styles.td}>
                      {!member.isActive ? (
                        <span className={styles.statusDeactivated}>
                          Deactivated
                        </span>
                      ) : member.isPendingInvite ? (
                        <span className={styles.statusPending}>
                          Invite Pending
                        </span>
                      ) : (
                        <span className={styles.statusActive}>Active</span>
                      )}
                    </td>

                    <td className={styles.td}>
                      <FormattedDate value={member.createdAt} />
                    </td>

                    <td className={styles.td}>
                      <div className={styles.actionsCell}>
                        {member.isPendingInvite ? (
                          <button
                            type="button"
                            onClick={() => handleResendInvite(member.userId)}
                            disabled={actionLoadingId === member.userId}
                            className={styles.resendButton}
                            title="Resend invitation email"
                          >
                            <Send size={11} />
                            Resend Invite
                          </button>
                        ) : null}

                        {!isSelf ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleActive(member.userId, member.isActive)
                            }
                            disabled={actionLoadingId === member.userId}
                            className={styles.actionButton}
                          >
                            {member.isActive ? 'Deactivate' : 'Reactivate'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen ? (
        <InviteMemberModal
          onClose={() => setModalOpen(false)}
          onMemberInvited={() => {
            fetchTeam();
          }}
        />
      ) : null}
    </div>
  );
}

