/** API mode is explicit and simple (reads build-time env; not a React hook). */
export function isApiLayerEnabled() {
  const raw = String(import.meta.env.VITE_USE_API || '').toLowerCase();
  if (raw === 'false') return false;
  return true;
}

/** Base URL for REST calls, no dev proxy required. */
export function getApiBaseUrl() {
  const v = import.meta.env.VITE_API_BASE_URL;
  return v ? String(v).replace(/\/$/, '') : 'http://127.0.0.1:8787/api';
}
