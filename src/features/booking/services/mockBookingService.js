export function assertDemoBookingAvailable(environment = process.env.NODE_ENV) {
  if (environment === 'production') {
    throw new Error(
      'Demo booking services are disabled in production. Configure server-backed booking integrations.',
    );
  }
}
