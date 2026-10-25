import { isMobileToken, isRecord } from './contracts';

export const SESSION_STORAGE_KEY = 'surios.session.v1';
export type TokenStorage = { read: () => Promise<string | null>; write: (token: string) => Promise<void>; clear: () => Promise<void> };

export function storedToken(value: string | null, origin: string): string | null {
  if (!value) return null;
  try {
    const record: unknown = JSON.parse(value);
    return isRecord(record) && record.origin === origin && isMobileToken(record.token) ? record.token : null;
  } catch { return null; }
}

export const serializeToken = (token: string, origin: string) => JSON.stringify({ origin, token });
