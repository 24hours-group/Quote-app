'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserCheck, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import styles from './AdminAcceptInviteForm.module.css';

export function AdminAcceptInviteForm() {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sessionEmail, setSessionEmail] = useState(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function checkAuthSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (mounted) {
          if (session?.user?.email) {
            setSessionEmail(session.user.email);
            setChecking(false);
          } else {
            // Wait slightly for hash parsing
            const timeout = setTimeout(async () => {
              if (!mounted) return;
              const {
                data: { session: delayedSession },
              } = await supabase.auth.getSession();
              if (delayedSession?.user?.email) {
                setSessionEmail(delayedSession.user.email);
              } else {
                setError(
                  'No active invitation session found. Your link may have expired or already been used.',
                );
              }
              setChecking(false);
            }, 1200);

            return () => clearTimeout(timeout);
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to verify invitation link.');
          setChecking(false);
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted && session?.user?.email) {
        setSessionEmail(session.user.email);
        setChecking(false);
        setError(null);
      }
    });

    checkAuthSession();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        router.replace('/admin');
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to set password. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <SurfaceCard>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <UserCheck size={24} />
          </div>
          <p className={styles.eyebrow}>Townexa Team Invitation</p>
          <h1 className={styles.title}>Accept Staff Invitation</h1>
          <p className={styles.subtitle}>
            Set a secure password for your administrative account to access the
            Townexa Operations Console.
          </p>
          {sessionEmail ? (
            <div className={styles.emailBadge}>{sessionEmail}</div>
          ) : null}
        </div>

        {checking ? (
          <div className={styles.loadingBox}>
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            <span>Verifying invitation credentials…</span>
          </div>
        ) : success ? (
          <div className={styles.form}>
            <div className={styles.success}>
              <CheckCircle2 size={18} />
              <span>Password created successfully! Loading console…</span>
            </div>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <label htmlFor="new-password" className={styles.label}>
                New Password (minimum 8 characters)
              </label>
              <input
                id="new-password"
                type="password"
                required
                autoComplete="new-password"
                className={styles.input}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="confirm-password" className={styles.label}>
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                autoComplete="new-password"
                className={styles.input}
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error ? (
              <div className={styles.error} role="alert">
                <AlertCircle size={14} className="inline mr-1 -mt-0.5" />
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className={styles.submitButton}
            >
              {submitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Activating Account…
                </>
              ) : (
                'Activate Staff Account'
              )}
            </button>

            <p className={styles.hint}>
              Already set up?{' '}
              <Link href="/admin-login" className={styles.link}>
                Sign in to Admin
              </Link>
            </p>
          </form>
        )}
      </SurfaceCard>
    </main>
  );
}

