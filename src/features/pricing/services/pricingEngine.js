import {
  PRICING_KEYS,
  pricingPolicy,
} from '@/features/pricing/services/pricingPolicy';

export class PricingInputError extends Error {
  constructor(message, code = 'INVALID_PRICING_INPUT') {
    super(message);
    this.name = 'PricingInputError';
    this.code = code;
  }
}

function parameterValue(parameters, key) {
  const parameter = parameters[key];
  if (!parameter || !Number.isFinite(parameter.value)) {
    throw new PricingInputError(
      `Pricing parameter ${key} is unavailable.`,
      'PRICING_CONFIGURATION_ERROR',
    );
  }
  return parameter.value;
}

function localMinutes(pricedAt, timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(pricedAt);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) throw new Error();
    return hour * 60 + minute;
  } catch {
    throw new PricingInputError('The vehicle location time zone is invalid.');
  }
}

function lineItem(itemCode, description, amountCents, options = {}) {
  return {
    itemCode,
    description,
    quantity: options.quantity ?? 1,
    unitAmountCents: options.unitAmountCents ?? amountCents,
    totalAmountCents: amountCents,
    payableNow: options.payableNow ?? true,
    confirmationRequired: options.confirmationRequired ?? false,
    metadata: options.metadata ?? {},
  };
}

function periodFor(parameters, pricedAt, timezone) {
  const minutes = localMinutes(pricedAt, timezone);
  const start = parameterValue(parameters, PRICING_KEYS.DAY_START);
  const end = parameterValue(parameters, PRICING_KEYS.DAY_END);
  return minutes >= start && minutes < end ? 'day' : 'night';
}

function fixedService(code, description, amountCents) {
  return [lineItem(code, description, amountCents)];
}

function calculateServiceItems({ answers, parameters, period }) {
  const serviceType = answers.resolvedServiceType || answers.serviceType;
  if (serviceType === 'jump_start') {
    const count = Number(answers.batteryCount);
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > parameterValue(parameters, PRICING_KEYS.JS_MAX_BATTERIES)
    ) {
      throw new PricingInputError(
        'The battery count requires dispatcher review.',
        'OVER_LIMIT',
      );
    }
    const key =
      count === 1
        ? period === 'day'
          ? PRICING_KEYS.JS_1_DAY
          : PRICING_KEYS.JS_1_NIGHT
        : PRICING_KEYS[`JS_${count}`];
    return fixedService(
      'jump_start',
      `Jump start · ${count} ${count === 1 ? 'battery' : 'batteries'}`,
      parameterValue(parameters, key),
    );
  }

  if (['flat_tire', 'tire_change', 'tire_replace'].includes(serviceType)) {
    const amount = parameterValue(
      parameters,
      period === 'day' ? PRICING_KEYS.TIRE_DAY : PRICING_KEYS.TIRE_NIGHT,
    );
    const items = fixedService(
      'tire_service',
      serviceType === 'tire_replace'
        ? 'Tire replacement service'
        : 'Tire change service',
      amount,
    );
    if (serviceType === 'tire_replace') {
      items.push(
        lineItem('replacement_tire', 'Replacement tire cost', 0, {
          payableNow: false,
          confirmationRequired: true,
          metadata: { tireSize: answers.tireSize || null },
        }),
      );
    }
    return items;
  }

  if (serviceType === 'locked_out' || serviceType === 'lockout') {
    return fixedService(
      'lockout',
      'Vehicle lockout service',
      parameterValue(
        parameters,
        period === 'day'
          ? PRICING_KEYS.LOCKOUT_DAY
          : PRICING_KEYS.LOCKOUT_NIGHT,
      ),
    );
  }

  if (
    serviceType === 'mechanic_check' ||
    (serviceType === 'other' && Boolean(answers.mechanicIssue))
  ) {
    return fixedService(
      'mechanic_assessment',
      'On-site mechanic assessment',
      parameterValue(
        parameters,
        period === 'day' ? PRICING_KEYS.MECH_DAY : PRICING_KEYS.MECH_NIGHT,
      ),
    );
  }

  if (serviceType === 'tow') {
    const miles = Number(answers.routeBillableMiles);
    if (
      !Number.isInteger(miles) ||
      miles < 1 ||
      miles > parameterValue(parameters, PRICING_KEYS.TOW_MAX_MI)
    ) {
      throw new PricingInputError(
        'The towing distance requires dispatcher review.',
        'OVER_LIMIT',
      );
    }
    const hookKey =
      answers.neutral === 'yes'
        ? PRICING_KEYS.TOW_HOOK_NEUTRAL_OK
        : PRICING_KEYS.TOW_HOOK_NEUTRAL_FAIL;
    const threshold = parameterValue(parameters, PRICING_KEYS.TOW_THRESHOLD_MI);
    const rateKey =
      miles <= threshold
        ? PRICING_KEYS.TOW_RATE_SHORT
        : PRICING_KEYS.TOW_RATE_LONG;
    const rate = parameterValue(parameters, rateKey);
    return [
      lineItem(
        'tow_hook',
        answers.neutral === 'yes'
          ? 'Hook fee · neutral works'
          : 'Hook fee · neutral unavailable or unsure',
        parameterValue(parameters, hookKey),
      ),
      lineItem(
        'tow_mileage',
        `Mileage · ${miles} mi × ${pricingPolicy.currency === 'USD' ? '$' : ''}${(rate / 100).toFixed(2)}`,
        miles * rate,
        {
          quantity: miles,
          unitAmountCents: rate,
          metadata: { rateBand: miles <= threshold ? 'short' : 'long' },
        },
      ),
    ];
  }

  if (serviceType === 'out_of_gas' || serviceType === 'fuel_delivery') {
    const gallons = Number(answers.gallons);
    if (!Number.isInteger(gallons) || gallons < 1)
      throw new PricingInputError('Choose the number of gallons.');
    const pricePerGallon = parameterValue(
      parameters,
      PRICING_KEYS.GAS_PRICE_PER_GAL,
    );
    return [
      lineItem(
        'gas_base',
        'Fuel delivery base',
        parameterValue(parameters, PRICING_KEYS.GAS_BASE),
      ),
      lineItem(
        'gas_gallons',
        `Fuel · ${gallons} gal`,
        gallons * pricePerGallon,
        { quantity: gallons, unitAmountCents: pricePerGallon },
      ),
      lineItem(
        'gas_delivery_mileage',
        'Delivery mileage beyond included distance',
        0,
        {
          payableNow: false,
          confirmationRequired: true,
          metadata: {
            includedMiles: parameterValue(
              parameters,
              PRICING_KEYS.GAS_INCLUDED_MI,
            ),
            ratePerMileCents: parameterValue(
              parameters,
              PRICING_KEYS.GAS_RATE_PER_MI,
            ),
          },
        },
      ),
    ];
  }

  if (serviceType === 'stuck' || serviceType === 'winch_out') {
    const feet = Number(answers.distanceFeet);
    if (!Number.isFinite(feet) || feet < 0)
      throw new PricingInputError('Enter the winch distance.');
    const included = parameterValue(parameters, PRICING_KEYS.WINCH_INCLUDED_FT);
    const stepFeet = parameterValue(parameters, PRICING_KEYS.WINCH_STEP_FT);
    const steps = Math.max(0, Math.ceil((feet - included) / stepFeet));
    const stepPrice = parameterValue(parameters, PRICING_KEYS.WINCH_STEP_PRICE);
    const items = fixedService(
      'winch_base',
      `Winch-out base · includes ${included} ft`,
      parameterValue(parameters, PRICING_KEYS.WINCH_BASE),
    );
    if (steps)
      items.push(
        lineItem(
          'winch_steps',
          `${steps} additional ${stepFeet}-ft ${steps === 1 ? 'step' : 'steps'}`,
          steps * stepPrice,
          { quantity: steps, unitAmountCents: stepPrice },
        ),
      );
    return items;
  }

  throw new PricingInputError(
    'This service cannot be priced online.',
    'UNLISTED_SERVICE',
  );
}

export function calculateQuote({
  answers,
  parameters,
  pricingVersion,
  timezone,
  pricedAt = new Date(),
}) {
  if (!(pricedAt instanceof Date) || Number.isNaN(pricedAt.getTime()))
    throw new PricingInputError('The pricing time is invalid.');
  const period = periodFor(parameters, pricedAt, timezone);
  const lineItems = calculateServiceItems({ answers, parameters, period });
  const totalPayableNowCents = lineItems
    .filter((item) => item.payableNow)
    .reduce((sum, item) => sum + item.totalAmountCents, 0);
  const validityMinutes = parameterValue(
    parameters,
    PRICING_KEYS.QUOTE_VALID_MIN,
  );
  return {
    currency: pricingPolicy.currency,
    pricingVersion,
    pricedAt: pricedAt.toISOString(),
    validUntil: new Date(
      pricedAt.getTime() + validityMinutes * 60 * 1000,
    ).toISOString(),
    timezone,
    period,
    lineItems,
    totalPayableNowCents,
    separatelyConfirmedCharges: lineItems
      .filter((item) => item.confirmationRequired)
      .map((item) => item.itemCode),
  };
}
