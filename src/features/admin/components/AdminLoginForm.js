'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, ShieldCheck, RefreshCw } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import styles from './AdminLoginForm.module.css';

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      router.replace('/admin');
      router.refresh();
    } catch (nextError) {
      setError(nextError.message || 'Sign-in failed. Please check your credentials.');
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <SurfaceCard>
        <div className={styles.header}>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-1">
            <Truck size={24} />
          </div>
          <p className={styles.eyebrow}>Townexa Dispatch</p>
          <h1 className={styles.title}>Admin Sign In</h1>
          <p className={styles.subtitle}>
            Sign in with an authorized staff account to manage live towing dispatches and pricing.
          </p>
        </div>

        <form className={styles.form} onSubmit={submit}>
          <div className={styles.inputGroup}>
            <label htmlFor="admin-email" className={styles.label}>
              Staff Email
            </label>
            <input
              id="admin-email"
              autoComplete="email"
              className={styles.input}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dispatcher@townexa.com"
              required
              type="email"
              value={email}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="admin-password" className={styles.label}>
              Password
            </label>
            <input
              id="admin-password"
              autoComplete="current-password"
              className={styles.input}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              type="password"
              value={password}
            />
          </div>

          {error ? (
            <div className={styles.error} role="alert">
              {error}
            </div>
          ) : null}

          <button
            className={styles.submitButton}
            disabled={submitting}
            type="submit"
          >
            {submitting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                Access Dispatch Console
              </>
            )}
          </button>
        </form>

        <p className={styles.hint}>
          Townexa Operations & Dispatch Console
        </p>
      </SurfaceCard>
    </main>
  );
}
