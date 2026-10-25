import { test, expect, type Page, type Route } from "@playwright/test";
import { source, official, user, uid, postId, siblingId, quoteId, stamp } from "./discussion-data";
const origin = process.env.SURIOS_TEST_API_ORIGIN || "https://mobile-api.surios.test";
const token = `surios_mobile_${"c".repeat(64)}`;
type Notification = { id: string; kind: string; postId: string; repostId: string | null; commentId: string | null; postTitle: string; actor: { id: string; name: string }; createdAt: string; readAt: string | null };
function notifications(): Notification[] {
  const base = { postId, repostId: null, commentId: uid(5), postTitle: "Demo drainage cover report", actor: { id: uid(40), name: "Demo Neighbour" }, createdAt: stamp, readAt: null };
  return [
    { ...base, id: uid(61), kind: "REPORT_RESOLVED", postId: siblingId, repostId: quoteId, commentId: null, actor: { id: uid(41), name: "Demo Municipal Office" } },
    { ...base, id: uid(62), kind: "COMMENT" },
    { ...base, id: uid(63), kind: "REPLY" },
    { ...base, id: uid(64), kind: "COMMENT", readAt: stamp, postTitle: "Demo previously read report" },
  ];
}
async function json(route: Route, value: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "http://localhost:8082", "Access-Control-Allow-Headers": "Authorization,Content-Type", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE" }, body: JSON.stringify(value) });
}
type Model = { items: Notification[]; patches: unknown[]; notificationReads: number };
async function fixture(page: Page, handle?: (route: Route, model: Model) => Promise<boolean>) {
  const model: Model = { items: notifications(), patches: [], notificationReads: 0 };
  await page.route(`${origin}/media/**`, (route) => route.fulfill({ path: "assets/images/icon.png", contentType: "image/png" }));
  await page.route(`${origin}/api/**`, async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    if (req.method() === "OPTIONS") return json(route, null);
    if (await handle?.(route, model)) return;
    if (path === "/api/auth/login") return json(route, { accessToken: token, tokenType: "Bearer", expiresAt: "2099-01-01T00:00:00Z", user });
    if (path === "/api/auth/session") return json(route, { expiresAt: "2099-01-01T00:00:00Z", user });
    expect(req.headers().authorization).toBe(`Bearer ${token}`); expect(req.headers().cookie).toBeUndefined();
    if (path === "/api/community/posts") return json(route, { feed: [{ kind: "post", post: source() }], currentPage: 1, hasMore: false });
    if (path === "/api/notifications") {
      if (req.method() === "PATCH") {
        const body = req.postDataJSON(); model.patches.push(body);
        model.items = model.items.map((n) => body.action === "read-all" || body.id === n.id ? { ...n, readAt: stamp } : n);
        return json(route, { success: true, unreadCount: model.items.filter((n) => !n.readAt).length, readAt: stamp });
      }
      model.notificationReads++;
      const limit = Number(url.searchParams.get("limit") || 20), items = model.items.filter((n) => url.searchParams.get("filter") !== "unread" || !n.readAt);
      return json(route, { items: items.slice(0, limit), unreadCount: model.items.filter((n) => !n.readAt).length, hasMore: items.length > limit, nextCursor: items.length > limit ? "next_page" : null });
    }
    if (path === `/api/community/posts/${postId}` || path === `/api/community/posts/${siblingId}`) return json(route, { post: source(path.endsWith(siblingId) ? siblingId : postId), reposts: [official()] });
    return json(route, { message: "Fixture endpoint unavailable" }, 404);
  });
  return model;
}
async function login(page: Page) {
  await page.goto("/login"); await page.getByRole("textbox", { name: "Email address" }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("DemoNotification123!"); await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start a community infrastructure report", exact: true })).toBeVisible();
}
async function openInbox(page: Page) {
  await page.getByRole("button", { name: "Updates", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
}
const row = (page: Page, title: string) => page.getByRole("button", { name: new RegExp(`^(Unread: )?${title}\\.`) }).first();
test("the inbox shows saved events, unread badges and filters without marking mere views read", async ({ page }) => {
  const model = await fixture(page); await login(page); await openInbox(page);
  await expect(page.getByText("3 unread notifications", { exact: true })).toBeVisible();
  await expect(row(page, "Report resolved")).toBeVisible(); await expect(page.getByText("Demo previously read report", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Unread", exact: true }).click();
  await expect(page.getByText("Demo previously read report", { exact: true })).toHaveCount(0);
  await expect(row(page, "New reply")).toBeVisible(); expect(model.patches).toEqual([]);
});
test("a resolution opens the exact government update on its sibling post and saves its read receipt", async ({ page }) => {
  const model = await fixture(page); await login(page); await openInbox(page);
  await row(page, "Report resolved").click();
  await expect(page).toHaveURL(new RegExp(`/post/${siblingId}\\?repost=${quoteId}`));
  await expect(page.getByText(official().body, { exact: true })).toBeVisible();
  await expect.poll(() => model.patches).toContainEqual({ action: "read", id: uid(61) });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByText("2 unread notifications", { exact: true })).toBeVisible();
});
test("mark-all waits for confirmation, prevents repeated submission and persists after reload", async ({ page }) => {
  let release!: () => void, attempts = 0;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const model = await fixture(page, async (route) => {
    if (new URL(route.request().url()).pathname === "/api/notifications" && route.request().method() === "PATCH") { attempts++; await gate; }
    return false;
  });
  await login(page); await openInbox(page);
  await page.getByRole("button", { name: "Mark all as read", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mark all as read", exact: true })).toBeDisabled();
  await expect(page.getByText("3 unread notifications", { exact: true })).toBeVisible(); release();
  await expect(page.getByText("0 unread notifications", { exact: true })).toBeVisible(); expect(attempts).toBe(1); expect(model.patches).toHaveLength(1);
  await page.reload(); await openInbox(page); await expect(page.getByText("0 unread notifications", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Unread", exact: true }).click(); await expect(page.getByText("You’re all caught up", { exact: true })).toBeVisible();
});
test("server failure is shown as an error, and retry loads genuine events", async ({ page }) => {
  let fail = true;
  await fixture(page, async (route) => {
    if (fail && new URL(route.request().url()).pathname === "/api/notifications") { await json(route, { message: "Demo inbox unavailable" }, 503); return true; }
    return false;
  });
  await login(page); await openInbox(page); await expect(page.getByRole("alert")).toContainText("Demo inbox unavailable");
  await expect(page.getByText("No notifications yet", { exact: true })).toHaveCount(0); fail = false;
  await page.getByRole("button", { name: "Retry loading notifications", exact: true }).click(); await expect(row(page, "Report resolved")).toBeVisible();
});
test("failed read-all does not clear unread data or claim success", async ({ page }) => {
  await fixture(page, async (route) => {
    if (route.request().method() === "PATCH") { await json(route, { message: "Demo read receipt rejected" }, 503); return true; } return false;
  });
  await login(page); await openInbox(page); await page.getByRole("button", { name: "Mark all as read", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Demo read receipt rejected"); await expect(page.getByText("3 unread notifications", { exact: true })).toBeVisible();
  await expect(page.getByText("Notifications marked as read.", { exact: true })).toHaveCount(0);
});
test("a stale page cannot overwrite an unread filter", async ({ page }) => {
  let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
  let paging = false;
  await fixture(page, async (route, model) => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/api/notifications" || url.searchParams.has("limit")) return false;
    if (url.searchParams.has("cursor")) {
      paging = true; await gate;
      await json(route, { items: [{ ...model.items[0], id: uid(99), postTitle: "Demo stale page" }], unreadCount: 3, hasMore: false, nextCursor: null }).catch(() => {}); return true;
    }
    if (url.searchParams.get("filter") === "all") { await json(route, { items: model.items.slice(0, 2), unreadCount: 3, hasMore: true, nextCursor: "old_page" }); return true; }
    return false;
  });
  await login(page); await openInbox(page); await page.getByRole("button", { name: "Load more notifications", exact: true }).click();
  await expect.poll(() => paging).toBe(true); await page.getByRole("button", { name: "Unread", exact: true }).click(); release();
  await expect(row(page, "New reply")).toBeVisible(); await expect(page.getByText("Demo stale page", { exact: true })).toHaveCount(0);
});
test("pagination merges overlapping pages without duplicate events", async ({ page }) => {
  await fixture(page, async (route, model) => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/api/notifications" || url.searchParams.has("limit")) return false;
    const next = url.searchParams.has("cursor");
    await json(route, { items: next ? model.items.slice(1) : model.items.slice(0, 2), unreadCount: 3, hasMore: !next, nextCursor: next ? null : "next_page" }); return true;
  });
  await login(page); await openInbox(page); await page.getByRole("button", { name: "Load more notifications", exact: true }).click();
  await expect(row(page, "New reply")).toBeVisible(); await expect(page.getByRole("button", { name: /^Unread: New comment\./ })).toHaveCount(1);
});
test("a delayed badge response cannot restore an unread count after mark-all succeeds", async ({ page }) => {
  let release!: () => void, requested = false;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await fixture(page, async (route, model) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/notifications" && url.searchParams.get("limit") === "1") {
      requested = true; const item = { ...model.items[0] }; await gate;
      await json(route, { items: [item], unreadCount: 3, hasMore: true, nextCursor: "old_badge" }).catch(() => {}); return true;
    } return false;
  });
  await login(page); await expect.poll(() => requested).toBe(true); await openInbox(page);
  await page.getByRole("button", { name: "Mark all as read", exact: true }).click(); await expect(page.getByText("0 unread notifications", { exact: true })).toBeVisible(); release();
  await expect(page.getByText("0 unread notifications", { exact: true })).toBeVisible(); await expect(page.getByRole("button", { name: "Mark all as read", exact: true })).toBeDisabled();
});
test("a failed individual read receipt still opens the post and leaves the event unread", async ({ page }) => {
  const model = await fixture(page, async (route) => {
    if (route.request().method() === "PATCH") { await json(route, { message: "Demo receipt unavailable" }, 503); return true; } return false;
  });
  await login(page); await openInbox(page); await row(page, "New comment").click(); await expect(page).toHaveURL(new RegExp(`/post/${postId}$`));
  await page.getByRole("button", { name: "Back", exact: true }).click(); await expect(page.getByText("3 unread notifications", { exact: true })).toBeVisible();
  expect(model.items.find((n) => n.id === uid(62))!.readAt).toBeNull();
});
test("expired notification sessions clear credentials and return to sign-in", async ({ page }) => {
  let expired = false;
  await fixture(page, async (route) => {
    if (expired && new URL(route.request().url()).pathname === "/api/notifications") { await json(route, { message: "Session revoked" }, 401); return true; } return false;
  });
  await login(page); expired = true; await page.getByRole("button", { name: "Updates", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible(); expect(await page.evaluate(() => sessionStorage.getItem("surios.session.v1"))).toBeNull();
});
test("an empty saved inbox has an honest empty state", async ({ page }) => {
  const model = await fixture(page); model.items = []; await login(page); await openInbox(page);
  await expect(page.getByText("No notifications yet", { exact: true })).toBeVisible(); await expect(page.getByRole("button", { name: "Mark all as read", exact: true })).toBeDisabled();
});
test("small, landscape and enlarged-text views preserve orange light appearance and operable controls", async ({ page }) => {
  await fixture(page); await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" }); await login(page); await openInbox(page);
  for (const size of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 812, height: 375 }]) {
    await page.setViewportSize(size); await expect(row(page, "Report resolved")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await page.getByRole("button", { name: "Unread", exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(48);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: "artifacts/notifications-mobile.png", fullPage: true });
  await page.evaluate(() => { for (const e of document.querySelectorAll<HTMLElement>('div,span')) if (!e.children.length) { const style = getComputedStyle(e), size = parseFloat(style.fontSize), line = parseFloat(style.lineHeight); e.style.fontSize = `${size*1.5}px`; if (Number.isFinite(line)) e.style.lineHeight = `${line*1.5}px`; } });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
