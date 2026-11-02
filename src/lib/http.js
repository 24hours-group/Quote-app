import { NextResponse } from 'next/server';

export function successResponse(data, init = {}) {
  return NextResponse.json({ success: true, data }, init);
}

export function errorResponse(code, message, status = 500) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status },
  );
}
