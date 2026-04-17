/** API mode is explicit and simple. */
export function useApiLayer() {
  return import.meta.env.VITE_USE_API === 'true';
}

/** Base URL for REST calls, no dev proxy required. */
export function getApiBaseUrl() {
  const v = import.meta.env.VITE_API_BASE_URL;
  return v ? String(v).replace(/\/$/, '') : 'http://127.0.0.1:8787/api';
}
