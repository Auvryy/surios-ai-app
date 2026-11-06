import { normalizeOtpCode } from './otp-code';
import { environment } from '../config/environment';
import { ApiError, createApiClient, validateApiOrigin } from '../lib/api-client';
import { isRecord, parseIssuedSession, parseRegistrationResult, parseSessionDetails, type Credentials, type Registration } from './contracts';

export const apiOrigin = () => validateApiOrigin(environment.apiBaseUrl, typeof __DEV__ !== 'undefined' && __DEV__);
export const apiRequest = createApiClient(apiOrigin);

export const authApi = {
  async login(input: Credentials, signal: AbortSignal) {
    return parseIssuedSession(await apiRequest('/api/auth/login', { method: 'POST', body: input, signal }));
  },
  async register(input: Registration, signal: AbortSignal) {
    return parseRegistrationResult(await apiRequest('/api/auth/register', { method: 'POST', body: input, signal }));
  },
  async confirmVerification(email: string, code: string, signal: AbortSignal) {
    return parseIssuedSession(await apiRequest('/api/auth/verification/confirm', { method: 'POST', body: { email, code: normalizeOtpCode(code) }, signal }));
  },
  async resendVerification(email: string, signal: AbortSignal) {
    const response: unknown = await apiRequest('/api/auth/verification/resend', { method: 'POST', body: { email }, signal });
    if (!isRecord(response) || typeof response.message !== 'string') throw new ApiError('The server returned an invalid response. Please try again.');
    return response.message;
  },
  async requestPasswordReset(email: string, signal: AbortSignal) {
    const response: unknown = await apiRequest('/api/auth/forgot-password', { method: 'POST', body: { email }, signal });
    if (!isRecord(response) || typeof response.message !== 'string') throw new ApiError('The server returned an invalid response. Please try again.');
    return response.message;
  },
  async resetPasswordWithCode(input: { email: string; code: string; newPassword: string; confirmPassword: string }, signal: AbortSignal) {
    const response: unknown = await apiRequest('/api/auth/reset-password', { method: 'POST', body: { ...input, code: normalizeOtpCode(input.code) }, signal });
    if (!isRecord(response) || typeof response.success !== 'string') throw new ApiError('The server returned an invalid response. Please try again.');
    return response.success;
  },
  async session(token: string, signal: AbortSignal) {
    return parseSessionDetails(await apiRequest('/api/auth/session', { token, signal }));
  },
  async logout(token: string) {
    await apiRequest('/api/auth/logout', { method: 'POST', token });
  },
};
