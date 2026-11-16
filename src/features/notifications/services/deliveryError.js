export class NotificationDeliveryError extends Error {
  constructor(code, { permanent = false, cause } = {}) {
    super('The notification provider did not accept the delivery.', { cause });
    this.name = 'NotificationDeliveryError';
    this.code = code;
    this.permanent = permanent;
  }
}

export function normalizeProviderError(error, provider) {
  if (error instanceof NotificationDeliveryError) return error;
  const status = Number(error?.statusCode || error?.status || 0);
  if (status === 401 || status === 403) {
    return new NotificationDeliveryError('provider_authentication', {
      permanent: true,
      cause: error,
    });
  }
  if (status === 400 || status === 404 || status === 422) {
    return new NotificationDeliveryError('recipient_rejected', {
      permanent: true,
      cause: error,
    });
  }
  if (status === 429) {
    return new NotificationDeliveryError('provider_rate_limited', {
      cause: error,
    });
  }
  return new NotificationDeliveryError(`${provider}_unavailable`, {
    cause: error,
  });
}
