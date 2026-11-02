export const routes = Object.freeze({
  home: '/',
  book: '/book',
  booking: (reference) => `/booking/${encodeURIComponent(reference)}`,
  paymentSuccess: '/payment/success',
  admin: '/admin',
  adminSettings: '/admin/settings',
});
