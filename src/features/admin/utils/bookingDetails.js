import {
  SERVICE_TYPE_LABELS,
  MECHANIC_ISSUE_LABELS,
  TIRE_HANDLING_LABELS,
  FUEL_TYPE_LABELS,
  ORIENTATION_LABELS,
  NEUTRAL_LABELS,
} from '@/features/booking/constants/serviceLabels';

export {
  SERVICE_TYPE_LABELS,
  MECHANIC_ISSUE_LABELS,
  TIRE_HANDLING_LABELS,
  FUEL_TYPE_LABELS,
  ORIENTATION_LABELS,
  NEUTRAL_LABELS,
};

export function getBookingLocations(booking) {
  const snapshot = booking?.quotes?.pricing_snapshot;
  const answers = booking?.service_requests?.structured_answers || {};

  const pickupAddress =
    snapshot?.pickup?.formattedAddress ||
    booking?.service_requests?.pickup_location?.formatted_address ||
    answers.locationAddress ||
    answers.formattedAddress ||
    null;

  const dropoffAddress =
    snapshot?.dropoff?.formattedAddress ||
    booking?.service_requests?.dropoff_location?.formatted_address ||
    answers.dropoffAddress ||
    answers.dropoffFormattedAddress ||
    null;

  const rawMiles =
    typeof snapshot?.route?.rawMiles === 'number'
      ? snapshot.route.rawMiles
      : typeof answers.routeRawMiles === 'number'
        ? answers.routeRawMiles
        : typeof answers.towMiles === 'number'
          ? answers.towMiles
          : null;

  const billableMiles =
    typeof snapshot?.route?.billableMiles === 'number'
      ? snapshot.route.billableMiles
      : typeof answers.routeBillableMiles === 'number'
        ? answers.routeBillableMiles
        : null;

  const durationSeconds =
    typeof snapshot?.route?.metadata?.durationSeconds === 'number'
      ? snapshot.route.metadata.durationSeconds
      : typeof answers.routeDurationSeconds === 'number'
        ? answers.routeDurationSeconds
        : null;

  const vehicle = snapshot?.vehicle || {
    year: answers.year || null,
    make: answers.make || null,
    model: answers.model || null,
    color: answers.vehicleColor || null,
  };

  const isTow =
    booking?.service_requests?.service_type === 'tow' ||
    Boolean(dropoffAddress) ||
    rawMiles !== null;

  const neutral = answers.neutral || null;

  return {
    pickupAddress,
    dropoffAddress,
    rawMiles,
    billableMiles,
    durationSeconds,
    vehicle,
    isTow,
    neutral,
    customerNotes:
      booking?.service_requests?.customer_notes ||
      answers.customerNotes ||
      null,
  };
}

export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

export function getServiceDisplay(booking) {
  const snapshot = booking?.quotes?.pricing_snapshot;
  const answers = booking?.service_requests?.structured_answers || {};
  const rawDbService = booking?.service_requests?.service_type;

  const rawKey =
    answers.resolvedServiceType ||
    answers.serviceType ||
    snapshot?.answers?.resolvedServiceType ||
    snapshot?.answers?.serviceType ||
    snapshot?.serviceType ||
    rawDbService;

  if (rawKey && SERVICE_TYPE_LABELS[rawKey]) {
    return SERVICE_TYPE_LABELS[rawKey];
  }

  if (rawDbService && rawDbService !== 'other' && SERVICE_TYPE_LABELS[rawDbService]) {
    return SERVICE_TYPE_LABELS[rawDbService];
  }

  if (rawDbService === 'tow' || answers.dropoffAddress || snapshot?.dropoff?.formattedAddress) {
    return SERVICE_TYPE_LABELS.tow;
  }

  return 'Roadside Assistance';
}

export function getServiceIssueDetails(booking) {
  const snapshot = booking?.quotes?.pricing_snapshot;
  const structuredAnswers = booking?.service_requests?.structured_answers || {};
  const snapshotAnswers = snapshot?.answers || {};
  const answers = { ...snapshotAnswers, ...structuredAnswers };
  const rawDbService = booking?.service_requests?.service_type;

  const serviceType =
    answers.resolvedServiceType ||
    answers.serviceType ||
    snapshot?.serviceType ||
    rawDbService;

  const details = [];

  // Mechanic Check
  if (serviceType === 'mechanic_check' || answers.mechanicIssue) {
    if (answers.mechanicIssue) {
      details.push({
        label: 'Reported Issue',
        value: MECHANIC_ISSUE_LABELS[answers.mechanicIssue] || answers.mechanicIssue,
        highlight: true,
      });
    }
    if (answers.mechanicNotes) {
      details.push({
        label: 'Mechanic Notes',
        value: answers.mechanicNotes,
      });
    }
  }

  // Fuel Delivery
  if (serviceType === 'out_of_gas' || serviceType === 'fuel_delivery' || answers.fuelType) {
    if (answers.fuelType) {
      details.push({
        label: 'Fuel Type',
        value: FUEL_TYPE_LABELS[answers.fuelType] || answers.fuelType,
      });
    }
    if (answers.gallons) {
      details.push({
        label: 'Gallons Requested',
        value: `${answers.gallons} gallons`,
        highlight: true,
      });
    }
  }

  // Flat Tire / Tire Change
  if (
    ['flat_tire', 'tire_change', 'tire_replace'].includes(serviceType) ||
    answers.tireHandling
  ) {
    if (answers.tireHandling) {
      details.push({
        label: 'Tire Handling',
        value: TIRE_HANDLING_LABELS[answers.tireHandling] || answers.tireHandling,
      });
    }
    if (answers.damagedTires) {
      details.push({
        label: 'Damaged Tires',
        value: answers.damagedTires === 1 ? '1 tire' : `${answers.damagedTires} tires`,
      });
    }
    if (answers.tireSize) {
      details.push({
        label: 'Tire Size',
        value: answers.tireSize,
        highlight: true,
      });
    }
  }

  // Lockout
  const childOrPet =
    answers.childOrPetInside ??
    snapshot?.specialFlags?.childOrPetInside ??
    null;
  if (serviceType === 'locked_out' || serviceType === 'lockout' || childOrPet !== null) {
    if (childOrPet === true) {
      details.push({
        label: 'EMERGENCY SAFETY ALERT',
        value: 'CHILD OR PET LOCKED INSIDE (URGENT)',
        urgent: true,
      });
    } else if (childOrPet === false) {
      details.push({
        label: 'Child / Pet Inside',
        value: 'No',
      });
    }
  }

  // Winch Out / Extrication
  if (serviceType === 'stuck' || serviceType === 'winch_out' || answers.orientation) {
    if (answers.orientation) {
      details.push({
        label: 'Vehicle Position',
        value: ORIENTATION_LABELS[answers.orientation] || answers.orientation,
      });
    }
    if (answers.distanceFeet) {
      details.push({
        label: 'Distance from Road',
        value: `${answers.distanceFeet} ft`,
      });
    }
    if (answers.stuckWheels && answers.stuckWheels.length > 0) {
      details.push({
        label: 'Stuck Wheels',
        value: Array.isArray(answers.stuckWheels)
          ? answers.stuckWheels.join(', ')
          : String(answers.stuckWheels),
      });
    }
  }

  // Jump Start
  if (serviceType === 'jump_start' || answers.batteryCount) {
    if (answers.batteryCount) {
      details.push({
        label: 'Batteries to Jump',
        value: answers.batteryCount > 4 ? '5+ batteries' : `${answers.batteryCount} battery`,
      });
    }
  }

  // Towing
  if (serviceType === 'tow' || answers.neutral || answers.dropoffName) {
    if (answers.neutral) {
      details.push({
        label: 'Can Shift to Neutral',
        value: NEUTRAL_LABELS[answers.neutral] || answers.neutral,
      });
    }
    if (answers.dropoffName) {
      details.push({
        label: 'Drop-off Facility',
        value: answers.dropoffName,
      });
    }
  }

  // Heavy Duty Flag
  if (snapshot?.vehicle?.isHeavyDuty || snapshot?.specialFlags?.heavyDuty) {
    details.push({
      label: 'Vehicle Classification',
      value: 'Heavy Duty (Truck / Large Vehicle)',
      highlight: true,
    });
  }

  return details;
}

export function getServiceIssueSummary(booking) {
  const snapshot = booking?.quotes?.pricing_snapshot;
  const structuredAnswers = booking?.service_requests?.structured_answers || {};
  const snapshotAnswers = snapshot?.answers || {};
  const answers = { ...snapshotAnswers, ...structuredAnswers };
  const rawDbService = booking?.service_requests?.service_type;

  const serviceType =
    answers.resolvedServiceType ||
    answers.serviceType ||
    snapshot?.serviceType ||
    rawDbService;

  if (serviceType === 'mechanic_check' || answers.mechanicIssue) {
    const issue = MECHANIC_ISSUE_LABELS[answers.mechanicIssue] || answers.mechanicIssue;
    return issue ? `Issue: ${issue}` : 'Assessment requested';
  }

  if (serviceType === 'out_of_gas' || serviceType === 'fuel_delivery') {
    const fuel = FUEL_TYPE_LABELS[answers.fuelType] || 'Gas';
    return answers.gallons ? `${fuel} (${answers.gallons} gal)` : fuel;
  }

  if (['flat_tire', 'tire_change', 'tire_replace'].includes(serviceType)) {
    const plan = TIRE_HANDLING_LABELS[answers.tireHandling] || 'Tire service';
    return answers.tireSize ? `${plan} · ${answers.tireSize}` : plan;
  }

  if (serviceType === 'locked_out' || serviceType === 'lockout') {
    const childOrPet = answers.childOrPetInside ?? snapshot?.specialFlags?.childOrPetInside;
    return childOrPet ? '⚠️ CHILD/PET LOCKED INSIDE' : 'Standard vehicle lockout';
  }

  if (serviceType === 'stuck' || serviceType === 'winch_out') {
    const pos = ORIENTATION_LABELS[answers.orientation] || 'Off-road';
    return answers.distanceFeet ? `${pos} (${answers.distanceFeet} ft off-road)` : pos;
  }

  if (serviceType === 'jump_start') {
    return `${answers.batteryCount || 1} battery jump`;
  }

  if (serviceType === 'tow') {
    const miles =
      typeof snapshot?.route?.rawMiles === 'number'
        ? snapshot.route.rawMiles
        : typeof answers.routeRawMiles === 'number'
          ? answers.routeRawMiles
          : null;
    return miles ? `${miles.toFixed(1)} mi tow` : 'Tow delivery';
  }

  return null;
}
