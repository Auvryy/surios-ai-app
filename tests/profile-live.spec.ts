import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Explicitly opt in with a disposable local database; never run against Azure.
test.skip(process.env.SURIOS_TEST_PROFILE_LIVE !== "1", "Requires an isolated SuriOS profile backend.");
const origin = process.env.SURIOS_TEST_API_ORIGIN || "https://localhost:5189";
const email = `mobile-profile-${Date.now()}@example.test`;
const password = "MobileProfileFixture123!";
let token = "", userId = "";
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

test.beforeAll(async ({ playwright }) => {
  if (process.env.SURIOS_TEST_PROFILE_LIVE !== "1") return;
  if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw new Error("Profile persistence tests require a loopback backend and disposable data.");
  const api = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  const response = await api.post("/api/auth/register", { data: { name: "Demo Mobile Profile Citizen", email, password, confirmPassword: password } });
  expect(response.status()).toBe(201);
  const session = await response.json(); token = session.accessToken; userId = session.user.id;
  await api.dispose();
});
test.afterAll(async ({ playwright }) => {
  if (!token) return;
  const api = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  await api.post("/api/auth/logout", { headers: { Authorization: `Bearer ${token}` } });
  await api.dispose();
});

test("real profile UI saves name and both photo files, restores the saved profile, and removes photos", async ({ page, playwright }) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Demo Persisted Mobile Profile");
  for (const label of ["Choose profile picture", "Choose cover photo"]) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: label, exact: true }).click();
    await (await chooser).setFiles("assets/images/icon.png");
    await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeEnabled();
  }
  const saving = page.waitForResponse((response) => response.url() === `${origin}/api/profile` && response.request().method() === "POST");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  expect((await saving).status()).toBe(200);
  await expect(page.getByText("Profile updated.", { exact: true })).toBeVisible();
  const api = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
  const result = await api.get("/api/profile"); expect(result.status()).toBe(200);
  const saved = await result.json();
  expect(saved.profile.name).toBe("Demo Persisted Mobile Profile");
  expect(saved.profile.id).toBe(userId); expect(saved.isOwner).toBe(true);
  const original = await readFile("assets/images/icon.png");
  for (const field of ["avatarUrl", "coverUrl"]) {
    expect(saved.profile[field]).toMatch(/^\/media\/[a-f0-9-]+\.png$/);
    const media = await api.get(saved.profile[field]);
    expect(media.status()).toBe(200); expect(media.headers()["content-type"]).toContain("image/png");
    expect(digest(await media.body())).toBe(digest(original));
  }
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Demo Persisted Mobile Profile", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Demo Persisted Mobile Profile's cover photo", exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/profile-real-backend-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.getByRole("button", { name: "Remove profile picture", exact: true }).click();
  await page.getByRole("button", { name: "Remove cover photo", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Profile updated.", { exact: true })).toBeVisible();
  const removed = await (await api.get("/api/profile")).json();
  expect(removed.profile.avatarUrl).toBeNull(); expect(removed.profile.coverUrl).toBeNull();
  const publicProfile = await (await api.get(`/api/profiles/${userId}`)).json();
  expect(publicProfile.profile.name).toBe("Demo Persisted Mobile Profile");
  expect(publicProfile.profile).not.toHaveProperty("email");
  expect(errors).toEqual([]); await api.dispose();
});

test("real office profile saves government fields through the same API", async ({ page, playwright }) => {
  test.skip(!process.env.SURIOS_PROFILE_OFFICE_EMAIL, "Needs an approved office fixture in the disposable database.");
  const officeEmail = process.env.SURIOS_PROFILE_OFFICE_EMAIL!;
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email address" }).fill(officeEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByLabel("Reports handled: 0", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.getByRole("button", { name: "Barangay", exact: true }).click();
  await page.getByRole("textbox", { name: "Jurisdiction", exact: true }).fill("Demo Test Barangay");
  await page.getByRole("textbox", { name: "About this office", exact: true }).fill("Demo office profile verification.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Barangay office · Demo Test Barangay", { exact: true })).toBeVisible();
  const api = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  const login = await api.post("/api/auth/login", { data: { email: officeEmail, password } });
  expect(login.status()).toBe(200); const session = await login.json();
  const response = await api.get("/api/profile", { headers: { Authorization: `Bearer ${session.accessToken}` } });
  const saved = await response.json();
  expect(saved.profile.governmentProfile).toEqual({ level: "BARANGAY", jurisdiction: "Demo Test Barangay", bio: "Demo office profile verification." });
  expect(saved.statistics).toEqual({ reports: 0, inProgress: 0, resolved: 0 });
  await api.post("/api/auth/logout", { headers: { Authorization: `Bearer ${session.accessToken}` } });
  await api.dispose();
});
