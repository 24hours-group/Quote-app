import 'server-only';

import { cookies } from 'next/headers';

const COOKIE_MAX_AGE_SECONDS = 2 * 60 * 60;
const cookieName =
  process.env.NODE_ENV === 'production'
    ? '__Host-roadside_booking_session'
    : 'roadside_booking_session';

export function getBookingSessionToken() {
  return cookies().get(cookieName)?.value || null;
}

export function setBookingSessionToken(token) {
  cookies().set(cookieName, token, {
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export function clearBookingSessionToken() {
  cookies().set(cookieName, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}
