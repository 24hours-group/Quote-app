export function formatMoney(amountCents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amountCents / 100);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function humanize(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function flattenObject(value, prefix = '') {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => {
    const label = prefix ? `${prefix} · ${humanize(key)}` : humanize(key);
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return flattenObject(item, label);
    }
    if (item === null || item === '' || item === false) return [];
    return [[label, Array.isArray(item) ? item.join(', ') : String(item)]];
  });
}
