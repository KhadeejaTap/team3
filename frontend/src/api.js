const API = 'http://localhost:5000/api';

export async function apiFetch(url, options = {}) {
  const target = new URL(url, window.location.origin);

  if (
    target.origin !== new URL(API).origin ||
    !target.pathname.startsWith('/api/')
  ) {
    throw new Error('Unexpected API address.');
  }

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