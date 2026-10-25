import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

test.skip(process.env.SURIOS_TEST_NOTIFICATIONS_LIVE !== "1", "Requires the isolated notification backend and disposable fixture data.");
test.describe.configure({ mode: "serial" });
const origin = process.env.SURIOS_TEST_API_ORIGIN || "https://127.0.0.1:5193";
const password = "MobileProfileFixture123!";
let seed: { first: string; sibling: string; other: string; accounts: Record<"alice" | "bob" | "carol", { id: string; email: string }> };
let alice: APIRequestContext, bob: APIRequestContext, carol: APIRequestContext, office: APIRequestContext, resolution = "";
async function inbox(api: APIRequestContext) { const r = await api.get("/api/notifications"); expect(r.status()).toBe(200); return r.json(); }
async function login(page: Page) {
  await page.goto("/login"); await page.getByRole("textbox", { name: "Email address" }).fill(seed.accounts.alice.email);
  await page.getByLabel("Password", { exact: true }).fill(password); await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start a community infrastructure report", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Updates", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
}
test.beforeAll(async ({ playwright }) => {
  if (process.env.SURIOS_TEST_NOTIFICATIONS_LIVE !== "1") return;
  if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw new Error("Notification integration writes require an isolated loopback backend.");
  seed = JSON.parse(await readFile("artifacts/notifications-seed.json", "utf8"));
  const guest = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  const auth = async (email: string) => {
    const response = await guest.post("/api/auth/login", { data: { email, password } }); expect(response.status()).toBe(200);
    return playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true, extraHTTPHeaders: { Authorization: `Bearer ${(await response.json()).accessToken}` } });
  };
  alice = await auth(seed.accounts.alice.email); bob = await auth(seed.accounts.bob.email); carol = await auth(seed.accounts.carol.email); office = await auth("mobile-notifications-office@example.test");
  await guest.dispose();
});
test.afterAll(async () => { for (const client of [alice, bob, carol, office]) if (client) await client.dispose(); });

test("actual linked-hazard resolution reaches both citizens and opens its official evidence from the mobile inbox", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
  const id = randomUUID();
  const update = () => office.post("/api/community/reposts", { multipart: { id, postId: seed.sibling, body: "Demo official repair completed with supporting inspection record.", status: "RESOLVED", evidence: { name: "demo-resolution.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% Demo resolution record\n%%EOF") } } });
  const published = await update(); expect(published.status()).toBe(201); resolution = (await published.json()).id;
  expect((await update()).status()).toBe(201);
  for (const api of [alice, bob]) {
    const saved = await inbox(api); expect(saved.unreadCount).toBe(1); expect(saved.items).toHaveLength(1);
    expect(saved.items[0]).toMatchObject({ postId: seed.sibling, repostId: resolution, kind: "REPORT_RESOLVED" });
  }
  expect((await inbox(carol)).unreadCount).toBe(0);
  const unrelated = await carol.get(`/api/community/posts/${seed.other}`); expect((await unrelated.json()).post.reportStatus).toBe("REPORTED");
  await page.setViewportSize({ width: 390, height: 844 }); await login(page);
  await expect(page.getByText("1 unread notification", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Unread: Report resolved\./ })).toBeVisible();
  await page.screenshot({ path: "artifacts/notifications-real-backend-mobile.png", fullPage: true });
  await page.getByRole("button", { name: /^Unread: Report resolved\./ }).click();
  await expect(page).toHaveURL(new RegExp(`/post/${seed.sibling}\\?repost=${resolution}`));
  await expect(page.getByText("Demo official repair completed with supporting inspection record.", { exact: true })).toBeVisible();
  await expect.poll(async () => (await inbox(alice)).unreadCount).toBe(0);
  const thread = await alice.get(`/api/community/posts/${seed.first}`), data = await thread.json();
  const evidence = data.reposts.find((q: { id: string }) => q.id === resolution).governmentUpdate.attachments[0].url;
  expect((await alice.get(evidence)).status()).toBe(200); expect(data.post.reportStatus).toBe("RESOLVED"); expect(errors).toEqual([]);
});

test("actual comments and replies persist across clients, and mark-all changes only this user's inbox", async ({ page }) => {
  const comment = await bob.post(`/api/community/posts/${seed.first}`, { data: { action: "comment", body: "Demo saved question about this report." } });
  expect(comment.status()).toBe(201); const parentId = (await comment.json()).comment.id;
  const reply = await carol.post(`/api/community/posts/${seed.first}`, { data: { action: "comment", parentId, body: "Demo saved reply from another citizen." } }); expect(reply.status()).toBe(201);
  const a = await inbox(alice), b = await inbox(bob);
  expect(a.items.filter((n: { kind: string }) => n.kind === "COMMENT")).toHaveLength(2);
  expect(b.items.some((n: { kind: string }) => n.kind === "REPLY")).toBe(true);
  await login(page); await expect(page.getByText("2 unread notifications", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark all as read", exact: true }).click(); await expect(page.getByText("0 unread notifications", { exact: true })).toBeVisible();
  expect((await inbox(alice)).unreadCount).toBe(0); expect((await inbox(bob)).unreadCount).toBe(b.unreadCount);
  await page.reload(); await page.getByRole("button", { name: "Updates", exact: true }).click(); await expect(page.getByText("0 unread notifications", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^New comment\./ }).first().click(); await expect(page).toHaveURL(new RegExp(`/post/${seed.first}$`));
  await expect(page.getByText("Demo saved question about this report.", { exact: true })).toBeVisible();
});
