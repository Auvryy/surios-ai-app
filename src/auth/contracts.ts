import { ApiError } from '../lib/api-client';

export type UserRole = 'CITIZEN' | 'OFFICER' | 'ENGINEER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'PENDING' | 'REJECTED' | 'INACTIVE';
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
  avatarUrl: string | null;
};
export type SessionDetails = { user: SessionUser; expiresAt: string };
export type Session = SessionDetails & { accessToken: string };
export type Credentials = { email: string; password: string };
export type Registration = Credentials & { name: string; confirmPassword: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isMobileToken(value: unknown): value is string {
  return typeof value === 'string' && /^surios_mobile_[a-f0-9]{64}$/.test(value);
}

export function parseSessionDetails(value: unknown): SessionDetails {
  if (!isRecord(value) || !isRecord(value.user)) throw new ApiError('The server returned an invalid account. Please try again.');
  const { user, expiresAt } = value;
  if (!['id', 'name', 'email'].every((field) => typeof user[field] === 'string' && user[field]) ||
      !['CITIZEN', 'OFFICER', 'ENGINEER', 'ADMIN'].includes(String(user.role)) ||
      !['ACTIVE', 'PENDING', 'REJECTED', 'INACTIVE'].includes(String(user.accountStatus)) ||
      typeof expiresAt !== 'string' || !Number.isFinite(Date.parse(expiresAt))) {
    throw new ApiError('The server returned an invalid session. Please try again.');
  }
  if (Date.parse(expiresAt) <= Date.now()) throw new ApiError('Your session has expired. Please sign in again.', 401);
  if (user.accountStatus === 'INACTIVE') throw new ApiError('This account is inactive. Contact your administrator.', 401);
  return {
    expiresAt,
    user: { id: user.id as string, name: user.name as string, email: user.email as string,
      role: user.role as UserRole, accountStatus: user.accountStatus as AccountStatus,
      avatarUrl: typeof user.avatarUrl === 'string' ? user.avatarUrl : null },
  };
}

export function parseIssuedSession(value: unknown): Session {
  const details = parseSessionDetails(value);
  if (!isRecord(value) || value.tokenType !== 'Bearer' || !isMobileToken(value.accessToken)) {
    throw new ApiError('The server did not return a valid sign-in credential. Please try again.');
  }
  return { ...details, accessToken: value.accessToken };
}
