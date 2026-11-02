const STORAGE_KEY = 'roadside-booking-draft-v1';
const DRAFT_TTL_MS = 2 * 60 * 60 * 1000;

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function getSessionStorage() {
  return typeof window === 'undefined' ? null : window.sessionStorage;
}

function sanitizeAnswers(answers) {
  const { verificationCode, paymentStatus, ...persistableAnswers } = answers;
  return persistableAnswers;
}

export async function loadBookingDraft() {
  await wait(250);
  const storage = getSessionStorage();
  if (!storage) return null;

  try {
    const draft = JSON.parse(storage.getItem(STORAGE_KEY));
    if (!draft || Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    return draft;
  } catch {
    storage.removeItem(STORAGE_KEY);
    return null;
  }
}

export async function saveBookingDraft({ currentScreenId, answers, history }) {
  const storage = getSessionStorage();
  if (!storage) return;

  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      currentScreenId,
      answers: sanitizeAnswers(answers),
      history,
      savedAt: Date.now(),
    }),
  );
}

export function clearBookingDraft() {
  getSessionStorage()?.removeItem(STORAGE_KEY);
}
