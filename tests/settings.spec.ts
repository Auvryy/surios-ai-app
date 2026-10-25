import { test, expect, type Page, type Route } from "@playwright/test";

const origin = process.env.SURIOS_TEST_API_ORIGIN || "https://mobile-api.surios.test";
const token = `surios_mobile_${"a".repeat(64)}`;
const user = { id: "7f66c73b-d78e-43c2-a84d-97c77c2eb2df", name: "Demo Settings Citizen", email: "settings@example.test", role: "CITIZEN", accountStatus: "ACTIVE", avatarUrl: null };
const password = "ExistingPassword123!";
const changed = "ChangedPassword456!";
const passwordMessage = "Password changed. Other sessions have been signed out.";
const recoveryMessage = "If an account uses that email, check your inbox for a reset link. If it does not arrive, try again later.";
type Model = { preferences: { emailComments: boolean; emailConfirmations: boolean; theme: string }; mailAvailable: boolean; requests: { path: string; body: unknown }[]; settingsReads: number };
async function json(route: Route, value: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", headers: {
    "Access-Control-Allow-Origin": "http://localhost:8082", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE",
  }, body: JSON.stringify(value) });
}
async function fixture(page: Page, options: { mailAvailable?: boolean; pending?: boolean; handle?: (route: Route, path: string, model: Model) => Promise<boolean> } = {}) {
  const model: Model = { preferences: { emailComments: true, emailConfirmations: false, theme: "dark" }, mailAvailable: options.mailAvailable ?? true, requests: [], settingsReads: 0 };
  const account = options.pending ? { ...user, role: "OFFICER", accountStatus: "PENDING" } : user;
  const settings = () => ({ preferences: model.preferences, email: user.email, mailAvailable: model.mailAvailable });
  await page.route(`${origin}/api/**`, async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") return json(route, null);
    if (await options.handle?.(route, path, model)) return;
    if (path === "/api/auth/login") return json(route, { accessToken: token, tokenType: "Bearer", expiresAt: "2099-01-01T00:00:00Z", user: account });
    if (path === "/api/auth/session") return json(route, { expiresAt: "2099-01-01T00:00:00Z", user: account });
    if (path === "/api/community/posts") return json(route, { feed: [], currentPage: 1, hasMore: false });
    if (path === "/api/profile") return json(route, { profile: { ...user, coverUrl: null, governmentProfile: null }, statistics: null, isOwner: true, total: 0, feed: [], currentPage: 1, hasMore: false });
    if (path === "/api/settings" || path === "/api/auth/password" || path === "/api/settings/reset-link") {
      expect(request.headers().authorization).toBe(`Bearer ${token}`); expect(request.headers().cookie).toBeUndefined();
      if (request.method() !== "GET") model.requests.push({ path, body: request.postData() ? request.postDataJSON() : null });
      if (path === "/api/settings") {
        if (request.method() === "PATCH") Object.assign(model.preferences, request.postDataJSON());
        else model.settingsReads++;
        return json(route, settings());
      }
      if (path === "/api/auth/password") return json(route, { success: passwordMessage });
      return json(route, { message: recoveryMessage });
    }
    return json(route, { message: "Not found" }, 404);
  });
  return model;
}
async function authenticate(page: Page) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email address" }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
async function open(page: Page) {
  await authenticate(page);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
}
async function fields(page: Page, values = { current: password, next: changed, confirm: changed }) {
  await page.getByLabel("Current password", { exact: true }).fill(values.current);
  await page.getByLabel("New password", { exact: true }).fill(values.next);
  await page.getByLabel("Confirm new password", { exact: true }).fill(values.confirm);
}
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => { const list: string[] = []; errors.set(page, list); page.on("pageerror", (error) => list.push(error.message)); });
test.afterEach(({ page }) => { expect(errors.get(page)).toEqual([]); });

test("Profile opens settings with server preferences, supports Back, and restores a direct settings link", async ({ page }) => {
  await fixture(page); await open(page);
  await expect(page.getByRole("checkbox", { name: "Comments and replies", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Post likes", exact: true })).not.toBeChecked();
  await expect(page.getByText(`Send updates to ${user.email}`, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change password", exact: true })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit profile", exact: true })).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByRole("checkbox", { name: "Comments and replies", exact: true })).toBeChecked();
  await expect(page.getByRole("button", { name: /dark mode|appearance/i })).toHaveCount(0);
});

test("saving preferences sends only the two booleans and reloads the persisted choices", async ({ page }) => {
  const model = await fixture(page); await open(page);
  await page.getByRole("checkbox", { name: "Comments and replies", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: "Post likes", exact: true }).check();
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Email preferences saved.");
  expect(model.requests).toEqual([{ path: "/api/settings", body: { emailComments: false, emailConfirmations: true } }]);
  expect(model.preferences.theme).toBe("dark");
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Comments and replies", exact: true })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Post likes", exact: true })).toBeChecked();
});

test("failed or malformed settings loads show retry without editable invented defaults", async ({ page }) => {
  let fail = true;
  await fixture(page, { handle: async (route, path) => {
    if (fail && path === "/api/settings") { await json(route, { preferences: { emailComments: "false" } }); return true; }
    return false;
  } });
  await open(page);
  await expect(page.getByRole("alert")).toContainText("could not be read");
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  fail = false; await page.getByRole("button", { name: "Retry loading settings", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Comments and replies", exact: true })).toBeChecked();
});

test("failed preference saves retain changed choices and only confirm success after retry", async ({ page }) => {
  let fail = true;
  await fixture(page, { handle: async (route, path) => {
    if (fail && path === "/api/settings" && route.request().method() === "PATCH") { await json(route, { message: "Settings could not be saved right now." }, 503); return true; }
    return false;
  } });
  await open(page); await page.getByRole("checkbox", { name: "Post likes", exact: true }).check();
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not be saved");
  await expect(page.getByRole("checkbox", { name: "Post likes", exact: true })).toBeChecked();
  await expect(page.getByRole("status")).toHaveCount(0);
  fail = false; await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Email preferences saved.");
});

test("mail outage disables recovery but still permits saving preferences", async ({ page }) => {
  const model = await fixture(page, { mailAvailable: false }); await open(page);
  await expect(page.getByText("Email delivery is currently unavailable. You can still save your preferences.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Email reset link", exact: true })).toBeDisabled();
  await page.getByRole("checkbox", { name: "Post likes", exact: true }).check();
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Email preferences saved.");
  expect(model.requests.every((entry) => entry.path === "/api/settings")).toBe(true);
});

test("a pending preference save locks controls and cannot issue duplicate or competing writes", async ({ page }) => {
  let release!: () => void; const held = new Promise<void>((resolve) => { release = resolve; }); let calls = 0;
  await fixture(page, { handle: async (route, path) => {
    if (path === "/api/settings" && route.request().method() === "PATCH") { calls++; await held; }
    return false;
  } });
  await open(page); await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saving…", exact: true })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "Post likes", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Email reset link", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeDisabled();
  expect(calls).toBe(1); release();
  await expect(page.getByRole("status")).toHaveText("Email preferences saved.");
});

test("password validation never sends mismatched, short or unchanged passwords", async ({ page }) => {
  const model = await fixture(page); await open(page);
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await fields(page, { current: password, next: "short", confirm: "short" });
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("8 and 128");
  await fields(page, { current: password, next: changed, confirm: "DifferentPassword" });
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("do not match");
  await fields(page, { current: password, next: password, confirm: password });
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("different password"); expect(model.requests).toHaveLength(0);
});

test("confirmed password changes clear sensitive fields and retain the current opaque session", async ({ page }) => {
  const model = await fixture(page); await open(page);
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await fields(page); await expect(page.getByLabel("Current password", { exact: true })).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show current password", exact: true }).click();
  await expect(page.getByLabel("Current password", { exact: true })).toHaveJSProperty("type", "text");
  const before = await page.evaluate(() => sessionStorage.getItem("surios.session.v1"));
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(passwordMessage);
  expect(model.requests).toEqual([{ path: "/api/auth/password", body: { currentPassword: password, newPassword: changed, confirmPassword: changed } }]);
  for (const name of ["Current password", "New password", "Confirm new password"]) await expect(page.getByLabel(name, { exact: true })).toHaveValue("");
  expect(await page.evaluate(() => sessionStorage.getItem("surios.session.v1"))).toBe(before);
  const storage = await page.evaluate(() => JSON.stringify({ session: { ...sessionStorage }, local: { ...localStorage } }));
  expect(storage).not.toContain(password); expect(storage).not.toContain(changed); expect(page.url()).not.toContain(password);
});

test("incorrect current passwords preserve the secure form for correction", async ({ page }) => {
  let fail = true;
  await fixture(page, { handle: async (route, path) => {
    if (fail && path === "/api/auth/password") { await json(route, { message: "Your current password is incorrect." }, 400); return true; }
    return false;
  } });
  await open(page); await page.getByRole("button", { name: "Change password", exact: true }).click(); await fields(page);
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Your current password is incorrect.");
  await expect(page.getByLabel("New password", { exact: true })).toHaveValue(changed);
  await expect(page.getByLabel("Current password", { exact: true })).toHaveValue(password);
  fail = false; await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(passwordMessage);
});

test("an in-flight password change locks the form and cannot submit twice", async ({ page }) => {
  let release!: () => void; const held = new Promise<void>((resolve) => { release = resolve; }); let calls = 0;
  await fixture(page, { handle: async (route, path) => {
    if (path === "/api/auth/password") { calls++; await held; }
    return false;
  } });
  await open(page); await page.getByRole("button", { name: "Change password", exact: true }).click(); await fields(page);
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.getByRole("button", { name: "Updating…", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Current password", { exact: true })).not.toBeEditable();
  await expect(page.getByRole("button", { name: "Show current password", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Change password", exact: true })).toBeDisabled();
  expect(calls).toBe(1); release();
  await expect(page.getByRole("status")).toHaveText(passwordMessage); expect(calls).toBe(1);
});

test("a malformed password response never clears the form or claims a confirmed change", async ({ page }) => {
  await fixture(page, { handle: async (route, path) => {
    if (path === "/api/auth/password") { await json(route, { success: true }); return true; }
    return false;
  } });
  await open(page); await page.getByRole("button", { name: "Change password", exact: true }).click(); await fields(page);
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("did not confirm");
  await expect(page.getByLabel("New password", { exact: true })).toHaveValue(changed);
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("recovery sends a bodyless authenticated request and displays the server's neutral inbox message", async ({ page }) => {
  const model = await fixture(page); await open(page);
  await page.getByRole("button", { name: "Email reset link", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(recoveryMessage);
  expect(model.requests).toEqual([{ path: "/api/settings/reset-link", body: null }]);
});

test("recovery delivery failure and rate limits never claim an email was sent", async ({ page }) => {
  let status = 503;
  await fixture(page, { handle: async (route, path) => {
    if (path === "/api/settings/reset-link") { await json(route, { message: status === 503 ? "Password recovery email could not be delivered. Try again later." : "Too many requests. Try again later." }, status); return true; }
    return false;
  } });
  await open(page); await page.getByRole("button", { name: "Email reset link", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not be delivered");
  await expect(page.getByRole("status")).toHaveCount(0);
  status = 429; await page.getByRole("button", { name: "Email reset link", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Too many requests");
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("a revoked settings session is cleared before any further account changes", async ({ page }) => {
  await fixture(page, { handle: async (route, path) => {
    if (path === "/api/settings" && route.request().method() === "PATCH") { await json(route, { message: "Session revoked." }, 401); return true; }
    return false;
  } });
  await open(page); await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("surios.session.v1"))).toBeNull();
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});

test("pending government accounts cannot open active settings or request its private API", async ({ page }) => {
  const model = await fixture(page, { pending: true }); await authenticate(page);
  await expect(page.getByText("Awaiting approval", { exact: true })).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByText("Awaiting approval", { exact: true })).toBeVisible();
  expect(model.settingsReads).toBe(0);
});

test("settings and security controls stay accessible in phone, landscape, dark-system and enlarged-text layouts", async ({ page }) => {
  await fixture(page); await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" }); await open(page);
  for (const size of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 812, height: 375 }]) {
    await page.setViewportSize(size);
    await expect(page.getByRole("button", { name: "Save preferences", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/settings-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page.getByLabel("Current password", { exact: true }).press("Enter");
  await expect(page.getByLabel("New password", { exact: true })).toBeFocused();
  await page.screenshot({ path: "artifacts/settings-security-mobile.png", fullPage: true });
  await expect(page.getByRole("button", { name: "Update password", exact: true })).toHaveCSS("background-color", "rgb(201, 61, 0)");
  await page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>("div, span, input")) {
      if (element.children.length) continue;
      const style = getComputedStyle(element), font = parseFloat(style.fontSize), line = parseFloat(style.lineHeight);
      element.style.fontSize = `${font * 1.5}px`; if (Number.isFinite(line)) element.style.lineHeight = `${line * 1.5}px`;
    }
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
