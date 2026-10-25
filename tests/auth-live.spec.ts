import { test, expect } from '@playwright/test';

// Opt-in only: point at a disposable local backend/database, never a live deployment.
test.skip(process.env.SURIOS_TEST_LIVE !== '1', 'Needs an isolated running SuriOS backend.');
const origin = process.env.SURIOS_TEST_API_ORIGIN || 'http://127.0.0.1:5185';
const email = process.env.SURIOS_TEST_EMAIL || 'mobile-auth@example.test';
const password = 'MobileAuthTest123!';

test('real backend accepts existing credentials, returns saved reports, restores and revokes logout', async ({ page, request }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('IncorrectTestPassword');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid email or password');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Demo · Mobile authentication verification', { exact: true })).toBeVisible();
  const record = await page.evaluate(() => sessionStorage.getItem('surios.session.v1'));
  const token = JSON.parse(record!).token;
  await page.reload();
  await expect(page.getByText('Demo · Mobile authentication verification', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  const revoked = await request.get(`${origin}/api/auth/session`, { headers: { Authorization: `Bearer ${token}` } });
  expect(revoked.status()).toBe(401);
});

test('real citizen signup creates an account that can sign in again with the same password', async ({ page }) => {
  const freshEmail = `mobile-${Date.now()}@example.test`;
  await page.goto('/register');
  await page.getByRole('textbox', { name: 'Full name' }).fill('Mobile Registration Test');
  await page.getByRole('textbox', { name: 'Email address' }).fill(freshEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText('Demo · Mobile authentication verification', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByText(freshEmail, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(freshEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Demo · Mobile authentication verification', { exact: true })).toBeVisible();
});
