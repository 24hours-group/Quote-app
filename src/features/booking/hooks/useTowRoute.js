'use client';

import { useCallback, useEffect, useState } from 'react';
import { toBookingRouteAnswers } from '@/features/booking/schemas/routeCalculationSchema';
import { calculateTowRoute } from '@/features/booking/services/routeClient';

function hasFreshMatchingRoute(answers) {
  return (
    answers.routeStatus === 'ready' &&
    answers.routePickupResolutionId === answers.locationResolutionId &&
    answers.routeDropoffResolutionId === answers.dropoffResolutionId &&
    Date.parse(answers.routeExpiresAt || '') > Date.now()
  );
}

export function useTowRoute(answers, setAnswers) {
  const [requestVersion, setRequestVersion] = useState(0);
  const pickupResolutionId = answers.locationResolutionId;
  const dropoffResolutionId = answers.dropoffResolutionId;
  const hasFresh = hasFreshMatchingRoute(answers);
  const [state, setState] = useState({
    status: hasFresh
      ? 'success'
      : pickupResolutionId && dropoffResolutionId
        ? 'loading'
        : 'idle',
    error: null,
  });

  useEffect(() => {
    if (!pickupResolutionId || !dropoffResolutionId) {
      setState({ status: 'idle', error: null });
      return undefined;
    }
    if (hasFreshMatchingRoute(answers)) {
      setState({ status: 'success', error: null });
      return undefined;
    }

    let active = true;
    setState({ status: 'loading', error: null });
    setAnswers({ routeCalculationId: undefined, routeStatus: undefined });
    calculateTowRoute({ pickupResolutionId, dropoffResolutionId })
      .then((route) => {
        if (!active) return;
        setAnswers({
          ...toBookingRouteAnswers(route),
          routeStatus: 'ready',
        });
        setState({ status: 'success', error: null });
      })
      .catch((error) => {
        if (!active) return;
        setAnswers({
          routeCalculationId: undefined,
          routeStatus: 'unavailable',
        });
        setState({ status: 'error', error });
      });

    return () => {
      active = false;
    };
    // Route requests are keyed only by confirmed endpoint IDs and explicit retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropoffResolutionId, pickupResolutionId, requestVersion]);

  const retry = useCallback(() => setRequestVersion((value) => value + 1), []);
  return { ...state, retry };
}
