const ENDPOINT = '/api/booking/session';
const UI_STORAGE_KEY = 'roadside-booking-ui-v1';

let serverVersion = null;
let operationQueue = Promise.resolve();

function getSessionStorage() {
  return typeof window === 'undefined' ? null : window.sessionStorage;
}

function storeMinimalUiState(currentScreenId) {
  getSessionStorage()?.setItem(
    UI_STORAGE_KEY,
    JSON.stringify({ currentScreenId, savedAt: Date.now() }),
  );
}

function enqueue(operation) {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.catch(() => undefined);
  return result;
}

async function request(method, body) {
  const response = await fetch(ENDPOINT, {
    method,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(
      payload?.error?.message || 'The booking session request failed.',
    );
    error.code = payload?.error?.code;
    error.status = response.status;
    throw error;
  }

  return payload.data;
}

async function createSession() {
  const session = await request('POST');
  serverVersion = session.version;
  return session;
}

async function restoreOrCreateSession() {
  const session = await request('GET');
  if (!session) return createSession();
  serverVersion = session.version;
  return session;
}

export function runBookingSessionOperation(operation) {
  return enqueue(async () => {
    if (serverVersion === null) await restoreOrCreateSession();
    const result = await operation(serverVersion);
    if (Number.isInteger(result?.version)) serverVersion = result.version;
    return result;
  });
}

export function loadBookingDraft() {
  return enqueue(async () => {
    const session = await restoreOrCreateSession();
    storeMinimalUiState(session.currentScreenId);
    return session;
  });
}

export function saveBookingDraft({ currentScreenId, answers, history }) {
  return enqueue(async () => {
    const save = async () => {
      if (serverVersion === null) await restoreOrCreateSession();

      const session = await request('PUT', {
        currentScreenId,
        answers,
        history,
        version: serverVersion,
      });
      serverVersion = session.version;
      storeMinimalUiState(session.currentScreenId);
      return session;
    };

    try {
      return await save();
    } catch (error) {
      if (error?.code !== 'BOOKING_SESSION_NOT_FOUND') throw error;
      serverVersion = null;
      await createSession();
      return save();
    }
  });
}

export function clearBookingDraft() {
  return enqueue(async () => {
    try {
      if (serverVersion !== null) {
        await request('DELETE', { version: serverVersion });
      }
    } finally {
      serverVersion = null;
      getSessionStorage()?.removeItem(UI_STORAGE_KEY);
    }
  });
}

export function resetBookingDraftServiceForTests() {
  serverVersion = null;
  operationQueue = Promise.resolve();
}
