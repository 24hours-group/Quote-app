'use client';

import { useState } from 'react';
import { X, UserPlus, RefreshCw, CheckCircle2, Copy, Check } from 'lucide-react';
import { ADMIN_ROLE_DESCRIPTIONS } from '@/features/admin/constants/adminRoles';
import styles from './InviteMemberModal.module.css';

export function InviteMemberModal({ onClose, onMemberInvited }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('dispatcher');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [invitedResult, setInvitedResult] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim(),
          role,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      setInvitedResult(data.data);
      if (onMemberInvited) {
        onMemberInvited(data.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyLink() {
    if (!invitedResult?.actionLink) return;
    try {
      await navigator.clipboard.writeText(invitedResult.actionLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.title}>Invite Admin Team Member</h2>
            <p className={styles.subtitle}>
              Send an invitation email to a dispatcher, operations lead, or administrator.
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {invitedResult ? (
          <div className={styles.successBox}>
            <div className={styles.successBanner}>
              <CheckCircle2 size={16} />
              <span>
                Invitation sent to {invitedResult.email}!
                {invitedResult.emailSent
                  ? ' An invitation email was dispatched via Resend.'
                  : ''}
              </span>
            </div>

            {invitedResult.actionLink ? (
              <div className={styles.linkBox}>
                <span className={styles.linkLabel}>
                  Direct Invitation Link
                </span>
                <div className={styles.linkRow}>
                  <input
                    readOnly
                    value={invitedResult.actionLink}
                    className={styles.linkInput}
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`${styles.copyButton} ${
                      copied ? styles.copyButtonCopied : ''
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check size={13} /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={13} /> Copy Link
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : null}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.submitButton}
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <label htmlFor="invite-name" className={styles.label}>
                Staff Full Name
              </label>
              <input
                id="invite-name"
                required
                className={styles.input}
                placeholder="e.g. Jane Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="invite-email" className={styles.label}>
                Staff Email Address
              </label>
              <input
                id="invite-email"
                type="email"
                required
                className={styles.input}
                placeholder="e.g. jane@townexa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <span className={styles.label}>Select Role & Access Level</span>
              <div className={styles.roleGrid}>
                {Object.entries(ADMIN_ROLE_DESCRIPTIONS).map(
                  ([roleKey, roleMeta]) => {
                    const isActive = role === roleKey;
                    return (
                      <button
                        key={roleKey}
                        type="button"
                        onClick={() => setRole(roleKey)}
                        className={`${styles.roleCard} ${
                          isActive ? styles.roleCardActive : ''
                        }`}
                      >
                        <div className={styles.roleHeader}>
                          <span>{roleMeta.label}</span>
                          {isActive ? (
                            <CheckCircle2 size={14} className="text-blue-600" />
                          ) : null}
                        </div>
                        <span className={styles.roleDescription}>
                          {roleMeta.description}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            {error ? (
              <div className={styles.error} role="alert">
                {error}
              </div>
            ) : null}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={styles.submitButton}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Sending Invitation…
                  </>
                ) : (
                  <>
                    <UserPlus size={14} /> Send Invitation
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

