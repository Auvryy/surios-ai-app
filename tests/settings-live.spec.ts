import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// These tests mutate only an explicitly configured disposable loopback backend.
test.skip(process.env.SURIOS_TEST_SETTINGS_LIVE !== "1", "Requires an isolated settings backend and local TLS mailbox.");
const origin = process.env.SURIOS_TEST_API_ORIGIN || "https://127.0.0.1:5189";
const password = "SettingsFixturePassword123!";
const newPassword = "UpdatedSettingsPassword456!";
test.beforeAll(() => {
  if (process.env.SURIOS_TEST_SETTINGS_LIVE === "1" && !["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
    throw new Error("Settings integration requires a loopback backend and disposable data.");
});
async function account(api: APIRequestContext) {
  const email = `settings-${randomUUID()}@example.test`;
  const response = await api.post(`${origin}/api/auth/register`, { data: { name: "Demo Settings Citizen", email, password, confirmPassword: password } });
  expect(response.status()).toBe(201);
  const issued = await response.json();
  return { email, token: issued.accessToken as string, headers: { Authorization: `Bearer ${issued.accessToken}` } };
}
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
}
async function currentToken(page: Page) {
  const stored = await page.evaluate(() => sessionStorage.getItem("surios.session.v1"));
  return JSON.parse(stored!).token as string;
}
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => { const errors: string[] = []; browserErrors.set(page, errors); page.on("pageerror", (error) => errors.push(error.message)); });
test.afterEach(({ page }) => { expect(browserErrors.get(page)).toEqual([]); });

test("actual mobile preferences persist in the shared database without overwriting website appearance", async ({ page, request }) => {
  const owner = await account(request);
  const initial = await request.patch(`${origin}/api/settings`, { headers: owner.headers, data: { theme: "dark", emailComments: false, emailConfirmations: false } });
  expect(initial.status()).toBe(200);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, owner.email);
  await page.getByRole("checkbox", { name: "Comments and replies", exact: true }).check();
  await page.getByRole("checkbox", { name: "Post likes", exact: true }).check();
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Email preferences saved.");
  const persisted = await request.get(`${origin}/api/settings`, { headers: owner.headers });
  expect(persisted.status()).toBe(200);
  expect((await persisted.json()).preferences).toEqual({ emailComments: true, emailConfirmations: true, theme: "dark" });
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Comments and replies", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Post likes", exact: true })).toBeChecked();
  await page.screenshot({ path: "artifacts/settings-real-backend-mobile.png", fullPage: true });
});

test("actual password changes retain this device, reject the old password and revoke the other device", async ({ page, request }) => {
  const owner = await account(request);
  await login(page, owner.email);
  const here = { Authorization: `Bearer ${await currentToken(page)}` };
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await page.getByLabel("Current password", { exact: true }).fill("WrongPassword123!");
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Your current password is incorrect.");
  expect((await request.get(`${origin}/api/auth/session`, { headers: owner.headers })).status()).toBe(200);
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Password changed. Other sessions have been signed out.");
  expect((await request.get(`${origin}/api/auth/session`, { headers: here })).status()).toBe(200);
  expect((await request.get(`${origin}/api/auth/session`, { headers: owner.headers })).status()).toBe(401);
  expect((await request.post(`${origin}/api/auth/login`, { data: { email: owner.email, password } })).status()).toBe(401);
  const fresh = await request.post(`${origin}/api/auth/login`, { data: { email: owner.email, password: newPassword } });
  expect(fresh.status()).toBe(200);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
});

test("a real recovery email reaches only the local TLS mailbox and its reset invalidates the saved session", async ({ page, request }) => {
  const owner = await account(request);
  await login(page, owner.email);
  await expect(page.getByRole("button", { name: "Email reset link", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Email reset link", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("check your inbox for a reset link");
  const response = await request.get(`${origin}/__fixture/mail`);
  expect(response.status()).toBe(200);
  const messages = await response.json() as { to: string[]; subject: string; text: string }[];
  const mail = messages.find((item) => item.to.includes(owner.email));
  expect(mail?.subject).toBe("Reset your SuriOS password");
  const resetToken = /\/reset-password#token=([a-f0-9]{64})/.exec(mail?.text || "")?.[1];
  expect(typeof resetToken).toBe("string");
  const reset = await request.post(`${origin}/api/auth/reset-password`, { data: { token: resetToken, newPassword, confirmPassword: newPassword } });
  expect(reset.status()).toBe(200);
  expect((await request.get(`${origin}/api/auth/session`, { headers: owner.headers })).status()).toBe(401);
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});

test("a rejected real SMTP delivery displays the backend failure instead of a sent-email success", async ({ page, request }) => {
  const owner = await account(request);
  await login(page, owner.email);
  expect((await request.post(`${origin}/__fixture/reject-mail`)).status()).toBe(200);
  await page.getByRole("button", { name: "Email reset link", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Password recovery email could not be delivered. Try again later.");
  await expect(page.getByRole("status")).toHaveCount(0);
  const messages = await (await request.get(`${origin}/__fixture/mail`)).json() as { to: string[] }[];
  expect(messages.some((mail) => mail.to.includes(owner.email))).toBe(false);
});
