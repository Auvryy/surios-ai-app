import { ApiError } from '../lib/api-client';
import type { Credentials, Registration, Session, SessionDetails } from './contracts';
import type { TokenStorage } from './stored-session';

type AuthApi = {
  login: (input: Credentials, signal: AbortSignal) => Promise<Session>;
  register: (input: Registration, signal: AbortSignal) => Promise<Session>;
  session: (token: string, signal: AbortSignal) => Promise<SessionDetails>;
  logout: (token: string) => Promise<void>;
};
export type AuthState = {
  status: 'loading' | 'signedOut' | 'signedIn' | 'unavailable';
  session: Session | null;
  busy: boolean;
  notice: string | null;
};

/** Owns session races and persistence; no UI or platform dependencies. */
export class SessionController {
  private api: AuthApi;
  private storage: TokenStorage;
  private listeners = new Set<() => void>();
  private revision = 0;
  private request: AbortController | null = null;
  private persistence: Promise<unknown> = Promise.resolve();
  private state: AuthState = { status: 'loading', session: null, busy: false, notice: null };

  constructor(api: AuthApi, storage: TokenStorage) { this.api = api; this.storage = storage; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(state: AuthState) { this.state = state; this.listeners.forEach((listener) => listener()); }
  private begin() { this.request?.abort(); this.request = new AbortController(); return { revision: ++this.revision, signal: this.request.signal }; }
  private persist<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.persistence.then(operation);
    this.persistence = result.catch(() => {});
    return result;
  }
  cancelAuthentication = () => {
    if (!this.state.busy || this.state.session) return;
    this.begin();
    this.update({ status: 'signedOut', session: null, notice: null, busy: false });
  };

  restore = async () => {
    if (this.state.busy) return;
    const cached = this.state.session;
    const { revision, signal } = this.begin();
    if (!cached) this.update({ status: 'loading', session: null, busy: false, notice: null });
    try {
      const token = cached?.accessToken || await this.persist(() => this.storage.read());
      if (revision !== this.revision) return;
      if (!token) { this.update({ status: 'signedOut', session: null, busy: false, notice: null }); return; }
      const details = await this.api.session(token, signal);
      if (revision === this.revision) this.update({ status: 'signedIn', session: { ...details, accessToken: token }, busy: false, notice: null });
    } catch (error) {
      if (revision !== this.revision) return;
      if (error instanceof ApiError && error.status === 401) {
        try { await this.persist(() => this.storage.clear()); }
        catch { this.update({ status: 'unavailable', session: null, busy: false, notice: 'Your session ended, but device storage could not be cleared. Please retry.' }); return; }
        if (revision === this.revision) this.update({ status: 'signedOut', session: null, busy: false, notice: 'Your session has ended. Please sign in again.' });
      } else {
        this.update({ status: cached ? 'signedIn' : 'unavailable', session: cached, busy: false, notice: error instanceof ApiError ? error.message : 'Your saved session could not be read. Please retry.' });
      }
    }
  };

  authenticate = async (mode: 'login' | 'register', input: Registration | Credentials) => {
    if (this.state.busy) return;
    const { revision, signal } = this.begin();
    this.update({ ...this.state, busy: true, notice: null });
    let issued: Session | null = null;
    try {
      issued = mode === 'login' ? await this.api.login(input, signal) : await this.api.register(input as Registration, signal);
      if (revision !== this.revision) { await this.api.logout(issued.accessToken).catch(() => {}); return; }
      const token = issued.accessToken;
      try {
        await this.persist(async () => {
          if (revision !== this.revision) return;
          await this.storage.write(token);
          if (revision !== this.revision) await this.storage.clear();
        });
      }
      catch {
        await this.api.logout(issued.accessToken).catch(() => {});
        throw new ApiError(mode === 'register'
          ? 'Your account was created, but sign-in could not be saved on this device. Open Sign in and try again.'
          : 'Sign-in could not be saved on this device. Check device storage and try again.');
      }
      if (revision !== this.revision) { await this.api.logout(issued.accessToken).catch(() => {}); return; }
      this.update({ status: 'signedIn', session: issued, busy: false, notice: null });
    } catch (error) {
      if (revision !== this.revision) return;
      this.update({ status: 'signedOut', session: null, busy: false, notice: null });
      throw error;
    }
  };

  signOut = async () => {
    if (this.state.busy) return;
    const { revision } = this.begin();
    this.update({ ...this.state, busy: true });
    let notice: string | null = null;
    try {
      const token = this.state.session?.accessToken || await this.persist(() => this.storage.read());
      if (token) {
        try { await this.api.logout(token); }
        catch (error) {
          if (!(error instanceof ApiError && error.status === 401)) notice = 'Signed out on this device. The server could not be reached to revoke the session.';
        }
      }
      await this.persist(() => this.storage.clear());
      if (revision === this.revision) this.update({ status: 'signedOut', session: null, busy: false, notice });
    } catch {
      if (revision === this.revision) this.update({ ...this.state, busy: false, notice: 'Device storage could not be cleared. Please try signing out again.' });
    }
  };

  invalidate = async (token: string) => {
    if (this.state.session?.accessToken !== token || this.state.busy) return;
    const { revision } = this.begin();
    try { await this.persist(() => this.storage.clear()); }
    catch {
      if (revision === this.revision) this.update({ status: 'unavailable', session: null, busy: false, notice: 'Your session ended, but device storage could not be cleared. Please retry.' });
      return;
    }
    if (revision === this.revision) this.update({ status: 'signedOut', session: null, busy: false, notice: 'Your session has ended. Please sign in again.' });
  };
}
