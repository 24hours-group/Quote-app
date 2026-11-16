'use client';

import { useCallback, useState } from 'react';
import { createHandoffLead } from '@/features/handoff/services/handoffClient';

export function useHandoffLead() {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const submit = useCallback(async (input) => {
    setStatus('loading');
    setError(null);
    try {
      const lead = await createHandoffLead(input);
      setStatus('success');
      return lead;
    } catch (nextError) {
      setStatus('error');
      setError(nextError);
      throw nextError;
    }
  }, []);

  return { error, isSubmitting: status === 'loading', status, submit };
}
