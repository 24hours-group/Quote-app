import {
  bookingFlow,
  HANDOFF_CODES,
  QUOTE_EDIT_SCREEN_IDS,
  screenConfigs,
  SERVICE_SCREEN_IDS,
} from '@/features/booking/config/bookingFlow';

const hasValue = (value) =>
  value !== undefined &&
  value !== null &&
  !(typeof value === 'string' && !value.trim());

function getValue(answers, screenId, field) {
  if (Object.prototype.hasOwnProperty.call(answers, field))
    return answers[field];

  const localAnswers = answers[screenId];
  if (
    localAnswers &&
    Object.prototype.hasOwnProperty.call(localAnswers, field)
  ) {
    return localAnswers[field];
  }

  return field.split('.').reduce((value, key) => value?.[key], answers);
}

function matches(condition, answers, screenId) {
  if (!condition) return true;
  if (condition.all) {
    return condition.all.every((item) => matches(item, answers, screenId));
  }
  if (condition.any) {
    return condition.any.some((item) => matches(item, answers, screenId));
  }

  const value = getValue(answers, screenId, condition.field);
  if ('eq' in condition) return value === condition.eq;
  if (condition.in) return condition.in.includes(value);
  if ('present' in condition) return hasValue(value) === condition.present;

  const numericValue = Number(value);
  if ('gt' in condition)
    return Number.isFinite(numericValue) && numericValue > condition.gt;
  if ('gte' in condition)
    return Number.isFinite(numericValue) && numericValue >= condition.gte;
  if (condition.between) {
    return (
      Number.isFinite(numericValue) &&
      numericValue >= condition.between[0] &&
      numericValue <= condition.between[1]
    );
  }
  if (condition.betweenExclusiveMin) {
    return (
      Number.isFinite(numericValue) &&
      numericValue > condition.betweenExclusiveMin[0] &&
      numericValue <= condition.betweenExclusiveMin[1]
    );
  }

  return false;
}

const validationRules = {
  fullName: (value) =>
    typeof value === 'string' &&
    value.trim().split(/\s+/).filter(Boolean).length >= 2,
  usMobile: (value) =>
    typeof value === 'string' &&
    value.replace(/\D/g, '').replace(/^1/, '').length === 10,
  true: (value) => value === true,
  positiveNumber: (value) =>
    Number.isFinite(Number(value)) && Number(value) > 0,
  nonNegativeNumber: (value) =>
    Number.isFinite(Number(value)) && Number(value) >= 0,
};

function getValidationErrors(config, answers) {
  const requiredErrors = (config.required ?? [])
    .filter((item) => matches(item.when, answers, config.id))
    .filter((item) => !hasValue(getValue(answers, config.id, item.field)))
    .map(({ field, message }) => ({ field, message }));

  const invalidErrors = (config.validations ?? [])
    .filter((item) => matches(item.when, answers, config.id))
    .filter((item) => hasValue(getValue(answers, config.id, item.field)))
    .filter(
      (item) =>
        !validationRules[item.rule](getValue(answers, config.id, item.field)),
    )
    .map(({ field, message }) => ({ field, message }));

  return [...requiredErrors, ...invalidErrors].filter(
    (error, index, errors) =>
      errors.findIndex((item) => item.field === error.field) === index,
  );
}

function validationTransition(
  screenId,
  errors,
  code = 'MANDATORY_ANSWER',
  message,
) {
  return {
    type: 'validation',
    from: screenId,
    to: screenId,
    screenId,
    code,
    isValid: false,
    errors,
    message: message ?? errors[0]?.message,
  };
}

function resolveTransition(config, transitionConfig, answers) {
  const dynamicDestination = transitionConfig.toField
    ? getValue(answers, config.id, transitionConfig.toField)
    : undefined;
  let destination = dynamicDestination ?? transitionConfig.to;
  const editReturnTo = answers.editReturnTo ?? answers.returnTo;

  if (
    transitionConfig.allowEditReturn &&
    editReturnTo &&
    screenConfigs[editReturnTo] &&
    editReturnTo !== config.id
  ) {
    destination = editReturnTo;
  }

  if (transitionConfig.reasonCode) {
    return {
      type: 'handoff',
      from: config.id,
      to: 'R',
      screenId: 'R',
      reasonCode: transitionConfig.reasonCode,
      isValid: true,
    };
  }

  if (transitionConfig.type === 'validation') {
    return validationTransition(
      config.id,
      [],
      transitionConfig.code,
      transitionConfig.message,
    );
  }

  const type = transitionConfig.type ?? 'screen';
  const result = {
    type,
    from: config.id,
    to: destination,
    screenId: destination,
    isValid: type !== 'stay',
  };

  for (const key of [
    'code',
    'noticeCode',
    'jobFlags',
    'outcome',
    'returnTo',
    'serviceType',
  ]) {
    if (transitionConfig[key] !== undefined)
      result[key] = transitionConfig[key];
  }

  if (transitionConfig.outcomeField) {
    result.outcome = getValue(
      answers,
      config.id,
      transitionConfig.outcomeField,
    );
  }

  return result;
}

/**
 * Evaluates one screen without side effects. Answers may be flat or grouped by screen ID.
 */
export function getNextTransition(screenId, answers = {}) {
  const config = screenConfigs[screenId];
  if (!config) throw new RangeError(`Unknown booking screen: ${screenId}`);

  if (answers.talkToPerson === true || answers.action === 'talk_to_person') {
    return {
      type: 'handoff',
      from: screenId,
      to: 'R',
      screenId: 'R',
      reasonCode: HANDOFF_CODES.USER_REQUEST,
      isValid: true,
    };
  }

  const transitionConfig = config.transitions.find((item) =>
    matches(item.when, answers, screenId),
  );
  const errors = getValidationErrors(config, answers);

  if (!transitionConfig) {
    return validationTransition(
      screenId,
      errors.length
        ? errors
        : [
            {
              field: null,
              message: 'Choose a valid answer before continuing.',
            },
          ],
    );
  }

  const canBypassValidation =
    transitionConfig.bypassValidation ||
    transitionConfig.reasonCode ||
    transitionConfig.type === 'validation' ||
    transitionConfig.type === 'stay';
  if (errors.length && !canBypassValidation) {
    return validationTransition(screenId, errors);
  }

  return resolveTransition(config, transitionConfig, answers);
}

/** Returns the currently selected path as screen IDs, without calculating pricing. */
export function getVisibleFlow(answers = {}) {
  const requestType = answers.requestType;
  const flow = ['S0', 'S1'];

  if (!requestType) return flow;
  flow.push('S2');

  if (requestType === 'new') {
    flow.push('S4', 'S5', 'S6');
    const serviceType = answers.serviceType;
    const serviceScreenId = SERVICE_SCREEN_IDS[serviceType];

    if (
      serviceScreenId === 'W1' ||
      (serviceScreenId === 'T1' && answers.tireHandling === 'tow')
    ) {
      if (serviceScreenId === 'T1') flow.push('T1');
      flow.push('W1', 'W2', 'S7', 'S8A');
    } else if (serviceScreenId) {
      flow.push(serviceScreenId, 'S7', 'S8A');
    } else if (serviceType === 'other') {
      flow.push('R');
    }
  } else if (requestType === 'existing' || requestType === 'cancel') {
    flow.push('S5', 'R');
  }

  if (answers.handoffReason && !flow.includes('R')) {
    const handoffFromIndex = answers.handoffFrom
      ? flow.indexOf(answers.handoffFrom)
      : flow.length - 1;
    flow.splice(Math.max(0, handoffFromIndex + 1), flow.length, 'R');
  }

  return flow;
}

/** Returns both the document's 1-of-9 progress and position in the selected path. */
export function getStepProgress(screenId, answers = {}) {
  const config = screenConfigs[screenId];
  if (!config) throw new RangeError(`Unknown booking screen: ${screenId}`);

  const visibleFlow = getVisibleFlow(answers);
  const visibleIndex = visibleFlow.indexOf(screenId);

  return {
    currentStep: config.step,
    totalSteps: bookingFlow.totalSteps,
    substep: config.substep ?? null,
    visibleIndex: visibleIndex === -1 ? null : visibleIndex + 1,
    visibleCount: visibleFlow.length,
  };
}

export function getScreenConfig(screenId) {
  return screenConfigs[screenId] ?? null;
}

export function isQuoteEditScreen(screenId) {
  return QUOTE_EDIT_SCREEN_IDS.includes(screenId);
}

export { bookingFlow, HANDOFF_CODES, screenConfigs };
