import { environment } from '../config/environment';
import { createApiClient, validateApiOrigin } from '../lib/api-client';
import { parseIssuedSession, parseSessionDetails, type Credentials, type Registration } from './contracts';

export const apiOrigin = () => validateApiOrigin(environment.apiBaseUrl, typeof __DEV__ !== 'undefined' && __DEV__);
export const apiRequest = createApiClient(apiOrigin);

export const authApi = {
  async login(input: Credentials, signal: AbortSignal) {
    return parseIssuedSession(await apiRequest('/api/auth/login', { method: 'POST', body: input, signal }));
  },
  async register(input: Registration, signal: AbortSignal) {
    return parseIssuedSession(await apiRequest('/api/auth/register', { method: 'POST', body: input, signal }));
  },
  async session(token: string, signal: AbortSignal) {
    return parseSessionDetails(await apiRequest('/api/auth/session', { token, signal }));
  },
  async logout(token: string) {
    await apiRequest('/api/auth/logout', { method: 'POST', token });
  },
};
