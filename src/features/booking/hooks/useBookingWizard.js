'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearBookingDraft,
  loadBookingDraft,
  saveBookingDraft,
} from '@/features/booking/services/bookingDraftService';
import {
  getNextTransition,
  getStepProgress,
} from '@/features/booking/utils/bookingFlow';

const initialState = {
  currentScreenId: 'S0',
  answers: {},
  history: [],
};

export function useBookingWizard() {
  const [wizard, setWizard] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [isHydrating, setIsHydrating] = useState(true);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [notice, setNotice] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let active = true;
    loadBookingDraft().then((draft) => {
      if (active && draft?.currentScreenId) {
        setWizard({
          currentScreenId: draft.currentScreenId,
          answers: draft.answers || {},
          history: draft.history || [],
        });
      }
      if (active) {
        hydratedRef.current = true;
        setIsHydrating(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current || outcome) return undefined;
    setSaveStatus('saving');
    const timeout = setTimeout(() => {
      saveBookingDraft(wizard)
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('error'));
    }, 250);
    return () => clearTimeout(timeout);
  }, [outcome, wizard]);

  const setAnswer = useCallback((field, value) => {
    setWizard((current) => ({
      ...current,
      answers: { ...current.answers, [field]: value },
    }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  const moveTo = useCallback((screenId, answerUpdates = {}, returnTo) => {
    setWizard((current) => ({
      currentScreenId: screenId,
      answers: {
        ...current.answers,
        ...answerUpdates,
        editReturnTo: returnTo || answerUpdates.editReturnTo,
      },
      history: [...current.history, current.currentScreenId],
    }));
    setErrors({});
  }, []);

  const applyTransition = useCallback(
    (transition) => {
      if (transition.type === 'complete') {
        setOutcome(transition.outcome);
        clearBookingDraft();
        return;
      }

      if (transition.type === 'handoff') {
        moveTo('R', {
          handoffReason: transition.reasonCode,
          handoffFrom: transition.from,
        });
        return;
      }

      if (transition.type === 'stay' || transition.type === 'validation') {
        setErrors(
          Object.fromEntries(
            (transition.errors || []).map(({ field, message }) => [
              field,
              message,
            ]),
          ),
        );
        return;
      }

      const updates = {};
      if (transition.serviceType)
        updates.resolvedServiceType = transition.serviceType;
      if (transition.returnTo) updates.editReturnTo = transition.returnTo;
      moveTo(transition.screenId, updates, transition.returnTo);
    },
    [moveTo],
  );

  const continueFlow = useCallback(() => {
    const transition = getNextTransition(
      wizard.currentScreenId,
      wizard.answers,
    );
    if (transition.noticeCode) {
      setNotice({ code: transition.noticeCode, transition });
      return;
    }
    applyTransition(transition);
  }, [applyTransition, wizard.answers, wizard.currentScreenId]);

  const continueWith = useCallback(
    (answerUpdates) => {
      const nextAnswers = { ...wizard.answers, ...answerUpdates };
      setWizard((current) => ({ ...current, answers: nextAnswers }));
      const transition = getNextTransition(wizard.currentScreenId, nextAnswers);
      if (transition.noticeCode) {
        setNotice({ code: transition.noticeCode, transition });
        return;
      }
      applyTransition(transition);
    },
    [applyTransition, wizard.answers, wizard.currentScreenId],
  );

  const confirmNotice = useCallback(() => {
    if (notice?.transition) applyTransition(notice.transition);
    setNotice(null);
  }, [applyTransition, notice]);

  const goBack = useCallback(() => {
    setWizard((current) => {
      if (!current.history.length) return current;
      const history = [...current.history];
      const currentScreenId = history.pop();
      return {
        currentScreenId,
        history,
        answers: {
          ...current.answers,
          handoffReason: undefined,
          handoffFrom: undefined,
        },
      };
    });
    setErrors({});
    setNotice(null);
  }, []);

  const requestHandoff = useCallback(() => {
    const transition = getNextTransition(wizard.currentScreenId, {
      ...wizard.answers,
      talkToPerson: true,
    });
    applyTransition(transition);
  }, [applyTransition, wizard.answers, wizard.currentScreenId]);

  const editScreen = useCallback(
    (screenId, returnTo = 'S7') => moveTo(screenId, {}, returnTo),
    [moveTo],
  );

  const completeWith = useCallback((nextOutcome) => {
    setOutcome(nextOutcome);
    clearBookingDraft();
  }, []);

  const restart = useCallback(() => {
    clearBookingDraft();
    setWizard(initialState);
    setErrors({});
    setOutcome(null);
    setNotice(null);
  }, []);

  const progress = useMemo(
    () => getStepProgress(wizard.currentScreenId, wizard.answers),
    [wizard.answers, wizard.currentScreenId],
  );

  return {
    ...wizard,
    completeWith,
    confirmNotice,
    continueFlow,
    continueWith,
    editScreen,
    errors,
    goBack,
    isHydrating,
    notice,
    outcome,
    progress,
    requestHandoff,
    restart,
    saveStatus,
    setAnswer,
  };
}
