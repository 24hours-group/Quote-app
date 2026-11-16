import 'server-only';

export function isPaymentSimulationEnabled(env = process.env) {
  if (env.NODE_ENV === 'production') return false;
  if (env.PAYMENT_SIMULATION_ENABLED === 'true') return true;
  if (env.PAYMENT_SIMULATION_ENABLED === 'false') return false;
  return !env.STRIPE_SECRET_KEY;
}
