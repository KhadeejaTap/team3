
const API_ORIGIN = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000'
).replace(/\/+$/, '');

export async function apiFetch(url, options = {}) {
  const configured = new URL(API_ORIGIN);
  const requested = new URL(url, configured.origin);

  const allowedOrigin =
    requested.origin === configured.origin ||
    requested.origin === 'http://localhost:5000';

  if (
    !allowedOrigin ||
    !requested.pathname.startsWith('/api/')
  ) {
    throw new Error('Unexpected API address.');
  }

  const target = new URL(
    requested.pathname + requested.search,
    configured.origin
  );

  const headers = new Headers(options.headers);
  const token = localStorage.getItem('user_token');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return window.fetch(target.href, {
    ...options,
    headers
  });
}
