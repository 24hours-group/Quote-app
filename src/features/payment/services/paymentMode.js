import 'server-only';

export function isPaymentSimulationEnabled(env = process.env) {
  if (env.PAYMENT_SIMULATION_ENABLED === 'false') return false;
  if (env.PAYMENT_SIMULATION_ENABLED === 'true') return true;
  return !env.STRIPE_SECRET_KEY;
}
