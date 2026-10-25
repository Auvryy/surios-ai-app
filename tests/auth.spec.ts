import { test, expect, type Page, type Route } from '@playwright/test';

const origin = process.env.SURIOS_TEST_API_ORIGIN || 'http://127.0.0.1:5185';
const token = `surios_mobile_${'a'.repeat(64)}`;
const user = { id: 'test-user', name: 'Alex Cruz', email: 'alex@example.test', role: 'CITIZEN', accountStatus: 'ACTIVE', avatarUrl: null };
const issued = { accessToken: token, tokenType: 'Bearer', user, expiresAt: '2099-01-01T00:00:00.000Z' };
const post = (id = 'test-post') => ({ id, title: `Demo drainage report ${id}`, body: 'Visible damage beside the canal.', createdAt: '2026-10-25T00:00:00Z', author: { name: 'Alex Cruz' }, media: [], reportStatus: 'RESOLVED', locationName: 'Santa Cruz, Laguna', governmentUpdateLink: `/community/post/${id}?repost=official` });
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => { expect(browserErrors.get(page)).toEqual([]); });

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': 'http://localhost:8082', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE' }, body: JSON.stringify(body) });
}
async function mock(page: Page, handler?: (route: Route, path: string) => Promise<boolean>) {
  await page.route(`${origin}/api/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'OPTIONS') { await json(route, null); return; }
    if (await handler?.(route, path)) return;
    if (path === '/api/auth/login' || path === '/api/auth/register') return json(route, issued);
    if (path === '/api/auth/session') return json(route, { user, expiresAt: issued.expiresAt });
    if (path === '/api/auth/logout') return json(route, { success: true });
    if (path === '/api/community/posts') return json(route, { feed: [{ kind: 'post', post: post() }], currentPage: 1, hasMore: false });
    return json(route, { message: 'Not found' }, 404);
  });
}
async function login(page: Page, password = 'TestPassword123!') {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email address' }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test('login sends real fields once, restores on reload, loads saved reports and signs out', async ({ page }) => {
  let logins = 0; let logouts = 0; let feedAuthorization = '';
  await mock(page, async (route, path) => {
    if (path === '/api/auth/login') {
      logins++;
      expect(route.request().postDataJSON()).toEqual({ email: user.email, password: 'TestPassword123!' });
      expect(route.request().headers().cookie).toBeUndefined();
    }
    if (path === '/api/community/posts') feedAuthorization = route.request().headers().authorization;
    if (path === '/api/auth/logout') logouts++;
    return false;
  });
  await login(page);
  await expect(page.getByText('Demo drainage report test-post', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Open post', exact: true }).scrollIntoViewIfNeeded();
  expect(feedAuthorization).toBe(`Bearer ${token}`);
  expect(logins).toBe(1);
  await page.reload();
  await expect(page.getByText('Demo drainage report test-post', { exact: true })).toBeVisible();
  expect(logins).toBe(1);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByText(user.email, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect(logouts).toBe(1);
  expect(await page.evaluate(() => sessionStorage.getItem('surios.session.v1'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('surios.session.v1'))).toBeNull();
  await page.goto('/citizen');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});

test('wrong passwords show the backend error and preserve the form for retry', async ({ page }) => {
  await mock(page, async (route, path) => {
    if (path === '/api/auth/login') { await json(route, { message: 'Invalid email or password' }, 401); return true; }
    return false;
  });
  await login(page, 'IncorrectPassword');
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password');
  await expect(page.getByRole('textbox', { name: 'Email address' })).toHaveValue(user.email);
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('IncorrectPassword');
  expect(await page.evaluate(() => sessionStorage.getItem('surios.session.v1'))).toBeNull();
});

test('an in-flight login disables submission and editing until the server responds', async ({ page }) => {
  let finish!: () => void;
  const response = new Promise<void>((resolve) => { finish = resolve; });
  await mock(page, async (route, path) => {
    if (path !== '/api/auth/login') return false;
    await response;
    await json(route, issued);
    return true;
  });
  await login(page);
  await expect(page.getByRole('button', { name: 'Signing in…', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Password', { exact: true })).not.toBeEditable();
  finish();
  await expect(page.getByText('Demo drainage report test-post', { exact: true })).toBeVisible();
});

test('registration validates matching passwords then creates a citizen account', async ({ page }) => {
  let registrations = 0;
  await mock(page, async (route, path) => {
    if (path === '/api/auth/register') {
      registrations++;
      expect(route.request().postDataJSON()).toEqual({ name: 'Alex Cruz', email: user.email, password: 'TestPassword123!', confirmPassword: 'TestPassword123!' });
    }
    return false;
  });
  await page.goto('/register');
  await page.getByRole('textbox', { name: 'Full name' }).fill('Alex Cruz');
  await page.getByRole('textbox', { name: 'Email address' }).fill('Alex@Example.Test');
  await page.getByLabel('Password', { exact: true }).fill('TestPassword123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('DifferentPassword');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText('Passwords do not match.', { exact: true })).toBeVisible();
  expect(registrations).toBe(0);
  await page.getByLabel('Confirm password', { exact: true }).fill('TestPassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText('Demo drainage report test-post', { exact: true })).toBeVisible();
  expect(registrations).toBe(1);
});

test('pending government accounts see approval status and never request the feed', async ({ page }) => {
  let feeds = 0;
  await mock(page, async (route, path) => {
    if (path === '/api/auth/login') { await json(route, { ...issued, user: { ...user, role: 'OFFICER', accountStatus: 'PENDING' } }); return true; }
    if (path === '/api/community/posts') feeds++;
    return false;
  });
  await login(page);
  await expect(page.getByText('Awaiting approval', { exact: true })).toBeVisible();
  expect(feeds).toBe(0);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});

test('a revoked saved session clears credentials and requests a fresh sign-in', async ({ page }) => {
  await mock(page, async (route, path) => {
    if (path === '/api/auth/session') { await json(route, { message: 'Session revoked' }, 401); return true; }
    return false;
  });
  await login(page);
  await expect(page.getByRole('button', { name: 'Start a community infrastructure report', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('session has ended');
  expect(await page.evaluate(() => sessionStorage.getItem('surios.session.v1'))).toBeNull();
});

test('an offline saved session offers retry and keeps the credential until verification succeeds', async ({ page }) => {
  let offline = false;
  await mock(page, async (route, path) => {
    if (offline && path === '/api/auth/session') { await route.abort('failed'); return true; }
    return false;
  });
  await login(page);
  await expect(page.getByRole('button', { name: 'Start a community infrastructure report', exact: true })).toBeVisible();
  offline = true;
  await page.reload();
  await expect(page.getByText('Let’s reconnect', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('surios.session.v1'))).not.toBeNull();
  offline = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('Demo drainage report test-post', { exact: true })).toBeVisible();
});

test('missing Azure API and rate limits are visible without pretending sign-in succeeded', async ({ page }) => {
  let rateLimited = false;
  await mock(page, async (route, path) => {
    if (path !== '/api/auth/login') return false;
    if (rateLimited) await json(route, { message: 'Too many attempts. Please wait.' }, 429);
    else await route.fulfill({ status: 404, contentType: 'text/html', headers: { 'Access-Control-Allow-Origin': 'http://localhost:8082' }, body: '<html>Not found</html>' });
    return true;
  });
  await login(page);
  await expect(page.getByRole('alert')).toContainText('Wait for the Azure build');
  rateLimited = true;
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Too many attempts');
});

test('cumulative feed pagination replaces items instead of duplicating them', async ({ page }) => {
  await mock(page, async (route, path) => {
    if (path === '/api/community/posts') {
      const second = new URL(route.request().url()).searchParams.get('page') === '2';
      await json(route, { feed: (second ? ['one', 'two'] : ['one']).map((id) => ({ kind: 'post', post: post(id) })), currentPage: second ? 2 : 1, hasMore: !second });
      return true;
    }
    return false;
  });
  await login(page);
  await page.getByRole('button', { name: 'Load more reports' }).click();
  await expect(page.getByText('Demo drainage report two', { exact: true })).toBeVisible();
  await expect(page.getByText('Demo drainage report one', { exact: true })).toHaveCount(1);
});

test('official photo attachments appear in the feed with an overflow count', async ({ page }) => {
  await page.route(`${origin}/media/*.png`, route => route.fulfill({ contentType: 'image/png', path: 'assets/images/icon.png' }));
  await mock(page, async (route, path) => {
    if (path !== '/api/community/posts') return false;
    const repost = { id: 'official', body: 'Demo maintenance completed.', createdAt: '2026-10-25T00:00:00Z', author: { name: 'Demo municipal office' }, media: [], governmentUpdate: { status: 'RESOLVED', attachments: [{ id: 'photo-one', kind: 'photo', url: '/media/one.png', name: 'one.png', mimeType: 'image/png' }, { id: 'photo-two', kind: 'photo', url: '/media/two.png', name: 'two.png', mimeType: 'image/png' }] }, post: post() };
    await json(route, { feed: [{ kind: 'repost', repost }], currentPage: 1, hasMore: false });
    return true;
  });
  await login(page);
  await expect(page.getByRole('img', { name: 'Photo attached by Demo municipal office' })).toBeAttached();
  await expect(page.getByText('+1 photos', { exact: true })).toBeAttached();
  await expect(page.getByRole('link', { name: 'Resolved: view official explanation', exact: true })).toBeAttached();
});

test('small, landscape and large-text layouts retain orange light appearance without overflow', async ({ page }) => {
  await mock(page);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const size of [{ width: 320, height: 700 }, { width: 375, height: 812 }, { width: 812, height: 375 }]) {
    await page.setViewportSize(size);
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCSS('background-color', 'rgb(201, 61, 0)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('textbox', { name: 'Email address' }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('TestPassword123!');
  await page.getByLabel('Password', { exact: true }).press('Enter');
  await expect(page.getByText('Demo drainage report test-post', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const text = [...document.querySelectorAll<HTMLElement>('div, span, input')].filter((element) => element.children.length === 0);
    const sizes = text.map((element) => [element, parseFloat(getComputedStyle(element).fontSize), parseFloat(getComputedStyle(element).lineHeight)] as const);
    for (const [element, font, line] of sizes) {
      element.style.fontSize = `${font * 1.5}px`;
      if (Number.isFinite(line)) element.style.lineHeight = `${line * 1.5}px`;
    }
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('device-storage failure revokes the new token and keeps the user signed out', async ({ page }) => {
  let revocations = 0;
  await mock(page, async (_route, path) => { if (path === '/api/auth/logout') revocations++; return false; });
  await page.addInitScript(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'surios.session.v1') throw new DOMException('Storage unavailable', 'QuotaExceededError');
      return write.call(this, key, value);
    };
  });
  await login(page);
  await expect(page.getByRole('alert')).toContainText('Sign-in could not be saved');
  expect(revocations).toBe(1);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});

test('expired credentials on a feature request clear the session and return to sign-in', async ({ page }) => {
  await mock(page, async (route, path) => {
    if (path === '/api/community/posts') { await json(route, { message: 'Session revoked' }, 401); return true; }
    return false;
  });
  await login(page);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('session has ended');
  expect(await page.evaluate(() => sessionStorage.getItem('surios.session.v1'))).toBeNull();
});
