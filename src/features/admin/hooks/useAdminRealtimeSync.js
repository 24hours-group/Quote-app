'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function useAdminRealtimeSync({
  onSync,
  pollingIntervalMs = 10000,
  enabled = true,
} = {}) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const inFlightRef = useRef(false);
  const debounceTimeoutRef = useRef(null);

  const fetchLatestDashboard = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsSyncing(true);

    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        if (onSync) {
          onSync(json.data);
        }
        setLastSyncedAt(new Date());
      }
    } catch (err) {
      console.warn('Real-time dashboard sync fetch notice:', err?.message);
    } finally {
      inFlightRef.current = false;
      setIsSyncing(false);
    }
  }, [onSync]);

  const scheduleSync = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      fetchLatestDashboard();
    }, 250);
  }, [fetchLatestDashboard]);

  useEffect(() => {
    if (!enabled) return;

    let supabase = null;
    let channel = null;

    try {
      supabase = createSupabaseBrowserClient();
      channel = supabase
        .channel('admin-realtime-sync')
        .on('broadcast', { event: 'submission_sync' }, () => {
          scheduleSync();
        })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bookings' },
          () => {
            scheduleSync();
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'handoff_leads' },
          () => {
            scheduleSync();
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'dispatch_notifications' },
          () => {
            scheduleSync();
          },
        )
        .subscribe((status) => {
          setIsConnected(status === 'SUBSCRIBED');
        });
    } catch {
      // In environments where Supabase env vars are not set, rely on polling
      setIsConnected(false);
    }

    function handleVisibilityOrFocus() {
      if (document.visibilityState === 'visible') {
        scheduleSync();
      }
    }

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    let intervalId = null;
    if (pollingIntervalMs > 0) {
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchLatestDashboard();
        }
      }, pollingIntervalMs);
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [enabled, fetchLatestDashboard, pollingIntervalMs, scheduleSync]);

  return {
    isSyncing,
    isConnected,
    lastSyncedAt,
    syncNow: fetchLatestDashboard,
  };
}

