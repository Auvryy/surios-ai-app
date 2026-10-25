import { test, expect } from '@playwright/test';
import { ApiError, createApiClient, validateApiOrigin } from '../src/lib/api-client';
import { SessionController } from '../src/auth/session-controller';
import { parseIssuedSession, parseSessionDetails, type Session } from '../src/auth/contracts';
import { serializeToken, storedToken, type TokenStorage } from '../src/auth/stored-session';
import { parseFeedPage, publicUrl } from '../src/lib/feed';

const token = `surios_mobile_${'a'.repeat(64)}`;
const secondToken = `surios_mobile_${'b'.repeat(64)}`;
const user = { id: 'citizen-id', name: 'Test Citizen', email: 'citizen@example.test', role: 'CITIZEN' as const, accountStatus: 'ACTIVE' as const, avatarUrl: null };
const session: Session = { accessToken: token, user, expiresAt: new Date(Date.now() + 86400000).toISOString() };
const credentials = { email: user.email, password: 'TestPassword123!' };

function setup(initial: string | null = null) {
  let saved = initial;
  const revoked: string[] = [];
  const storage: TokenStorage = { async read() { return saved; }, async write(value) { saved = value; }, async clear() { saved = null; } };
  const api = {
    async login() { return session; }, async register() { return session; },
    async session() { return { user, expiresAt: session.expiresAt }; },
    async logout(value: string) { revoked.push(value); },
  };
  const controller = new SessionController(api, storage);
  return { controller, api, storage, revoked, saved: () => saved };
}

test('API origins accept development IPs and require HTTPS in releases', () => {
  expect(validateApiOrigin('http://104.215.147.125:3000', true)).toBe('http://104.215.147.125:3000');
  for (const invalid of [null, 'server', 'https://server/api', 'https://user:secret@server', 'https://server?token=bad', 'http://server']) {
    expect(() => validateApiOrigin(invalid)).toThrow(ApiError);
  }
  expect(validateApiOrigin('https://surios.site/')).toBe('https://surios.site');
});

test('API transport uses bearer JSON and omits web cookies', async () => {
  const request = createApiClient(() => 'https://server.example', async (url, options) => {
    expect(url).toBe('https://server.example/api/auth/login');
    expect(options?.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });
    expect(options?.credentials).toBe('omit');
    expect(options?.redirect).toBe('error');
    expect(JSON.parse(String(options?.body))).toEqual(credentials);
    return Response.json({ ok: true });
  });
  expect(await request('/api/auth/login', { method: 'POST', body: credentials, token })).toEqual({ ok: true });
  await expect(request('//untrusted.example/api')).rejects.toThrow('Invalid API path');
  await expect(request('/api/../../private')).rejects.toThrow('Invalid API path');
});

test('API error handling preserves server messages and handles HTML and network failures', async () => {
  await expect(createApiClient(() => 'https://server', async () => Response.json({ message: 'Invalid email or password' }, { status: 401 }))('/api/auth/login')).rejects.toMatchObject({ status: 401, message: 'Invalid email or password' });
  await expect(createApiClient(() => 'https://server', async () => new Response('<html>missing</html>', { status: 404 }))('/api/auth/login')).rejects.toThrow('Wait for the Azure build');
  await expect(createApiClient(() => 'https://server', async () => { throw new TypeError('Network error'); })('/api')).rejects.toThrow('Cannot reach SuriOS');
});

test('slow API requests time out with a retryable message', async () => {
  const request = createApiClient(() => 'https://server', async (_url, options) => new Promise<Response>((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
  }), 10);
  await expect(request('/api/auth/session')).rejects.toThrow('took too long');
});

test('token records are bound to the issuing origin and malformed records are rejected', () => {
  expect(storedToken(serializeToken(token, 'https://one'), 'https://one')).toBe(token);
  expect(storedToken(serializeToken(token, 'https://one'), 'https://two')).toBeNull();
  expect(storedToken('{bad', 'https://one')).toBeNull();
  expect(storedToken(JSON.stringify({ origin: 'https://one', token: 'bad' }), 'https://one')).toBeNull();
});

test('session contracts reject expired, malformed and inactive accounts', () => {
  expect(parseIssuedSession({ ...session, tokenType: 'Bearer' })).toEqual(session);
  for (const invalid of [{}, { ...session, accessToken: 'bad', tokenType: 'Bearer' }, { ...session, tokenType: 'cookie' }, { ...session, tokenType: 'Bearer', expiresAt: '2020-01-01' }, { ...session, tokenType: 'Bearer', user: { ...user, accountStatus: 'INACTIVE' } }]) {
    expect(() => parseIssuedSession(invalid)).toThrow(ApiError);
  }
  expect(parseSessionDetails({ ...session, user: { ...user, accountStatus: 'PENDING' } }).user.accountStatus).toBe('PENDING');
});

test('successful sign-in persists a token and restores the account after restarting', async () => {
  const instance = setup();
  await instance.controller.restore();
  await instance.controller.authenticate('login', credentials);
  expect(instance.saved()).toBe(token);
  expect(instance.controller.getSnapshot().session?.user).toEqual(user);
  const restarted = new SessionController(instance.api, instance.storage);
  await restarted.restore();
  expect(restarted.getSnapshot().status).toBe('signedIn');
  expect(restarted.getSnapshot().session?.accessToken).toBe(token);
});

test('registration uses the registration API and failed login stores nothing', async () => {
  const instance = setup();
  instance.api.login = async () => { throw new ApiError('Invalid email or password', 401); };
  await expect(instance.controller.authenticate('login', credentials)).rejects.toThrow('Invalid email');
  expect(instance.saved()).toBeNull();
  expect(instance.controller.getSnapshot().status).toBe('signedOut');
  await instance.controller.authenticate('register', { ...credentials, name: user.name, confirmPassword: credentials.password });
  expect(instance.controller.getSnapshot().status).toBe('signedIn');
});

test('storage failure revokes the issued token and does not claim successful login', async () => {
  const instance = setup();
  instance.storage.write = async () => { throw new Error('Storage blocked'); };
  await expect(instance.controller.authenticate('login', credentials)).rejects.toThrow('could not be saved');
  expect(instance.revoked).toEqual([token]);
  expect(instance.controller.getSnapshot().session).toBeNull();
});

test('expired saved sessions are cleared, while an offline restore remains retryable', async () => {
  const instance = setup(token);
  instance.api.session = async () => { throw new ApiError('Offline'); };
  await instance.controller.restore();
  expect(instance.saved()).toBe(token);
  expect(instance.controller.getSnapshot().status).toBe('unavailable');
  instance.api.session = async () => { throw new ApiError('Revoked', 401); };
  await instance.controller.restore();
  expect(instance.saved()).toBeNull();
  expect(instance.controller.getSnapshot().status).toBe('signedOut');
});

test('logout revokes the current server session and clears the device', async () => {
  const instance = setup(token);
  await instance.controller.restore();
  await instance.controller.signOut();
  expect(instance.revoked).toEqual([token]);
  expect(instance.saved()).toBeNull();
  expect(instance.controller.getSnapshot().status).toBe('signedOut');
});

test('offline logout clears the device and reports that remote revocation was unavailable', async () => {
  const instance = setup(token);
  await instance.controller.restore();
  instance.api.logout = async () => { throw new ApiError('Offline'); };
  await instance.controller.signOut();
  expect(instance.saved()).toBeNull();
  expect(instance.controller.getSnapshot().notice).toContain('could not be reached');
});

test('cancelled login revokes a late response without signing the user in', async () => {
  const instance = setup();
  let finish!: (value: Session) => void;
  instance.api.login = () => new Promise((resolve) => { finish = resolve; });
  const pending = instance.controller.authenticate('login', credentials);
  instance.controller.cancelAuthentication();
  finish(session);
  await pending;
  expect(instance.saved()).toBeNull();
  expect(instance.revoked).toEqual([token]);
  expect(instance.controller.getSnapshot().status).toBe('signedOut');
});

test('repeated submissions issue only one login request', async () => {
  const instance = setup();
  let calls = 0;
  let finish!: (value: Session) => void;
  instance.api.login = () => { calls++; return new Promise((resolve) => { finish = resolve; }); };
  const first = instance.controller.authenticate('login', credentials);
  await instance.controller.authenticate('login', credentials);
  expect(calls).toBe(1);
  finish(session); await first;
  expect(instance.controller.getSnapshot().status).toBe('signedIn');
});

test('a delayed credential write cannot leave a cancelled login saved', async () => {
  const instance = setup();
  const originalWrite = instance.storage.write;
  let started!: () => void;
  let finish!: () => void;
  const writing = new Promise<void>((resolve) => { started = resolve; });
  instance.storage.write = async (value) => { started(); await new Promise<void>((resolve) => { finish = resolve; }); await originalWrite(value); };
  const pending = instance.controller.authenticate('login', credentials);
  await writing;
  instance.controller.cancelAuthentication();
  finish(); await pending;
  expect(instance.saved()).toBeNull();
  expect(instance.revoked).toEqual([token]);
});

test('an old unauthorized response cannot clear a newly signed-in account', async () => {
  const instance = setup();
  instance.api.login = async () => ({ ...session, accessToken: secondToken });
  await instance.controller.authenticate('login', credentials);
  await instance.controller.invalidate(token);
  expect(instance.saved()).toBe(secondToken);
  await instance.controller.invalidate(secondToken);
  expect(instance.saved()).toBeNull();
});

test('feed contracts preserve canonical resolution links and replace cumulative pages', () => {
  const post = { id: 'post-id', title: 'Demo infrastructure report', body: 'Test evidence', createdAt: '2026-10-25T00:00:00Z', author: { name: 'Test Citizen' }, media: [], reportStatus: 'RESOLVED', governmentUpdateLink: '/community/post/post-id?repost=official' };
  const page = parseFeedPage({ feed: [{ kind: 'post', post }], currentPage: 2, hasMore: false });
  expect(page.feed[0].status).toBe('RESOLVED');
  expect(page.feed[0].resolutionUrl).toBe(post.governmentUpdateLink);
  expect(publicUrl('/media/photo.jpg', 'https://server')).toBe('https://server/media/photo.jpg');
  expect(() => publicUrl('https://outside/media', 'https://server')).toThrow(ApiError);
  expect(() => parseFeedPage({ feed: [{}] })).toThrow(ApiError);
});

test('official repair photos include attachment evidence without duplicating gallery media', () => {
  const photo = { id: 'photo', kind: 'photo', url: '/media/evidence.jpg' };
  const quote = {
    id: 'official', body: 'Demo repair evidence', createdAt: '2026-10-25T00:00:00Z', author: { name: 'Demo office' },
    media: [photo], governmentUpdate: { attachments: [photo, { id: 'second', kind: 'photo', url: '/media/second.jpg' }, { id: 'pdf', kind: 'document', url: '/media/record.pdf' }] },
    post: { id: 'source', title: 'Original report', reportStatus: 'RESOLVED' },
  };
  const card = parseFeedPage({ feed: [{ kind: 'repost', repost: quote }], currentPage: 1, hasMore: false }).feed[0];
  expect(card.photoCount).toBe(2);
  expect(card.photoUrl).toBe('/media/evidence.jpg');
  expect(card.official).toBe(true);
  expect(card.status).toBe('RESOLVED');
});
