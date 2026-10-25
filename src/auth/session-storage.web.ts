import { apiOrigin } from './api';
import { SESSION_STORAGE_KEY, serializeToken, storedToken, type TokenStorage } from './stored-session';

// Browser preview only: never persist a bearer credential in localStorage.
export const sessionStorage: TokenStorage = {
  async read() {
    if (typeof window === 'undefined') return null;
    const value = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    return value ? storedToken(value, apiOrigin()) : null;
  },
  async write(token) { window.sessionStorage.setItem(SESSION_STORAGE_KEY, serializeToken(token, apiOrigin())); },
  async clear() { if (typeof window !== 'undefined') window.sessionStorage.removeItem(SESSION_STORAGE_KEY); },
};
