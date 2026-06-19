export function formatMoney(value) {
  return '$' + (Number(value) || 0).toLocaleString('es-MX');
}

export function uid(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export function normalizeText(value) {
  return String(value ?? '').trim();
}
