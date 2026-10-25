import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.skip(process.env.SURIOS_TEST_FEED_TOOLS_LIVE !== "1", "Requires this feature's disposable loopback backend fixture.");
test.describe.configure({ mode: "serial" });
const origin = process.env.SURIOS_TEST_API_ORIGIN || "https://127.0.0.1:5195";
const password = "MobileProfileFixture123!";
let alice: APIRequestContext, bob: APIRequestContext, office: APIRequestContext;
let seed: { first: string; sibling: string; critical: string; hazard: string; unrelated: string; social: string; official: string;
  accounts: { alice: { id: string; email: string; name: string }; bob: { id: string; email: string; name: string } }; office: { id: string; email: string } };
async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email address" }).fill(seed.accounts.alice.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start a community infrastructure report", exact: true })).toBeVisible();
}
async function thread(api: APIRequestContext, id: string) { const response = await api.get(`/api/community/posts/${id}`); expect(response.status()).toBe(200); return response.json(); }
test.beforeAll(async ({ playwright }) => {
  if (process.env.SURIOS_TEST_FEED_TOOLS_LIVE !== "1") return;
  const fixture = JSON.parse(await readFile("artifacts/feed-tools-fixture-state.json", "utf8"));
  if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname) || fixture.origin !== origin || !/^surios_mobile_feed_tools_\d+$/.test(fixture.database))
    throw new Error("Feed tool mutations require this session's isolated loopback fixture.");
  seed = JSON.parse(await readFile("artifacts/feed-tools-seed.json", "utf8"));
  const guest = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  const authenticated = async (email: string) => {
    if (!email.endsWith("@example.test")) throw new Error("Only disposable demo accounts are allowed.");
    const login = await guest.post("/api/auth/login", { data: { email, password } });
    expect(login.status()).toBe(200);
    return playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true, extraHTTPHeaders: { Authorization: `Bearer ${(await login.json()).accessToken}` } });
  };
  alice = await authenticated(seed.accounts.alice.email); bob = await authenticated(seed.accounts.bob.email); office = await authenticated(seed.office.email);
  await guest.dispose();
});
test.afterAll(async () => { await Promise.all([alice?.dispose(), bob?.dispose(), office?.dispose()]); });

test("real saved search, critical/media/sort filters and cumulative pages reach the whole database", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await signIn(page);
  await page.getByRole("textbox", { name: "Search community" }).fill("searchable bridge");
  await page.getByRole("button", { name: "Search posts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Demo searchable bridge railing", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start a community infrastructure report" })).toHaveCount(0);
  const read = await (await alice.get("/api/community/posts?q=searchable%20bridge&sort=relevance")).json();
  expect(read.feed.map((e: { id: string }) => e.id)).toContain(seed.first);
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page.getByRole("button", { name: "Critical", exact: true }).click();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("radio", { name: "Photos", exact: true }).click();
  await page.getByRole("radio", { name: "Highest severity", exact: true }).click();
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Demo urgent drainage cover", exact: true })).toBeVisible();
  const critical = await (await alice.get("/api/community/posts?tab=critical&media=photo&sort=severity")).json();
  expect(critical.total).toBe(1); expect(critical.feed[0].post.id).toBe(seed.critical);
  await page.getByRole("button", { name: "All updates", exact: true }).click();
  await page.getByRole("textbox", { name: "Search community" }).fill("archived infrastructure");
  const firstPageResponse = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === "/api/community/posts" && url.searchParams.get("q") === "archived infrastructure" && url.searchParams.get("page") === "1";
  });
  await page.getByRole("button", { name: "Search posts", exact: true }).click();
  await expect(page.getByText("23 results for “archived infrastructure”", { exact: true })).toBeVisible();
  expect((await (await firstPageResponse).json()).feed).toHaveLength(20);
  const secondPageResponse = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === "/api/community/posts" && url.searchParams.get("q") === "archived infrastructure" && url.searchParams.get("page") === "2";
  });
  await page.getByRole("button", { name: "Load more reports", exact: true }).click();
  const secondPage = await (await secondPageResponse).json();
  expect(secondPage.feed).toHaveLength(23);
  expect(new Set(secondPage.feed.map((entry: { id: string }) => entry.id)).size).toBe(23);
  await expect(page.getByRole("button", { name: "Load more reports", exact: true })).toHaveCount(0);
  await page.getByRole("heading", { name: secondPage.feed.at(-1).post.title, exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/feed-tools-real-search.png" });
});

test("real liked posts remain private to the signed-in account and reflect a saved unlike", async ({ page }) => {
  await signIn(page); await page.getByRole("button", { name: "Liked posts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Demo searchable bridge railing", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Government update", exact: true })).toBeVisible();
  expect((await (await alice.get("/api/community/posts?tab=liked")).json()).total).toBe(2);
  expect((await (await bob.get("/api/community/posts?tab=liked")).json()).total).toBe(0);
  await page.goto(`/post/${seed.first}`);
  await page.getByRole("button", { name: "Unlike post", exact: true }).click();
  await expect(page.getByRole("button", { name: "Like post", exact: true })).toBeVisible();
  await page.goto("/citizen"); await page.getByRole("button", { name: "Liked posts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Government update", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo searchable bridge railing", exact: true })).toHaveCount(0);
  expect((await (await alice.get("/api/community/posts?tab=liked")).json()).total).toBe(1);
});

test("real citizen and office profiles show public data while the account tab remains editable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await signIn(page);
  await page.goto(`/citizen?profile=${seed.accounts.bob.id}`);
  await expect(page.getByRole("heading", { name: `Posts by ${seed.accounts.bob.name}` })).toBeVisible();
  await expect(page.getByRole("img", { name: `${seed.accounts.bob.name}'s cover photo` })).toBeVisible();
  await expect(page.getByText(seed.accounts.bob.email, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit profile", exact: true })).toHaveCount(0);
  const profile = await (await alice.get(`/api/profiles/${seed.accounts.bob.id}`)).json();
  expect(profile.profile).not.toHaveProperty("email"); expect(profile.profile).not.toHaveProperty("badgeNumber"); expect(profile.isOwner).toBe(false);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByText(seed.accounts.alice.email, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit profile", exact: true })).toBeEnabled();
  await page.goto(`/citizen?profile=${seed.office.id}`);
  await expect(page.getByText("Municipal office · Demo Test Municipality", { exact: true })).toBeVisible();
  const officeData = await (await alice.get(`/api/profiles/${seed.office.id}`)).json();
  expect(officeData.statistics).toEqual({ reports: 1, inProgress: 0, resolved: 1 });
  await expect(page.getByRole("heading", { name: "Government update", exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/feed-tools-real-office.png" });
});

test("real owned deletion keeps grouped hazards, sibling evidence and official records intact", async ({ page }) => {
  expect((await bob.delete(`/api/community/posts/${seed.first}`)).status()).toBe(404);
  expect((await alice.delete(`/api/community/posts/${seed.sibling}`)).status()).toBe(404);
  expect((await office.delete(`/api/community/reposts?id=${seed.official}`)).status()).toBe(404);
  const before = await thread(alice, seed.sibling);
  const evidence = before.reposts.find((q: { id: string }) => q.id === seed.official).governmentUpdate.attachments[0].url;
  await signIn(page); await page.goto(`/post/${seed.sibling}?repost=${seed.social}`);
  await page.getByRole("button", { name: "More options for your repost", exact: true }).click();
  await page.getByRole("button", { name: "Delete repost", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete repost", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Demo linked access concern", exact: true })).toBeVisible();
  expect((await thread(alice, seed.sibling)).reposts.some((q: { id: string }) => q.id === seed.social)).toBe(false);
  await page.goto(`/post/${seed.first}`);
  await page.getByRole("button", { name: "More options for your post", exact: true }).click();
  await page.getByRole("button", { name: "Delete post", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete post", exact: true }).click();
  await expect(page.getByText("The author deleted the original post. The hazard and official response history are retained.", { exact: true })).toBeVisible();
  const removed = await thread(bob, seed.first), sibling = await thread(bob, seed.sibling);
  expect(removed.post.deletedAt).not.toBeNull(); expect(removed.post.media).toHaveLength(0);
  expect(sibling.post.deletedAt).toBeNull(); expect(sibling.post.reportStatus).toBe("RESOLVED");
  expect(sibling.post.governmentUpdateLink).toContain(seed.official);
  expect(sibling.reposts.some((q: { id: string }) => q.id === seed.official)).toBe(true);
  expect((await bob.get(sibling.post.media[0].url)).status()).toBe(200);
  expect((await bob.get(evidence)).status()).toBe(200);
  const remaining = await (await alice.get(`/api/community/posts?author=${seed.accounts.alice.id}&page=50`)).json();
  expect(remaining.feed.some((entry: { id: string }) => [seed.first, seed.social].includes(entry.id))).toBe(false);
  const web = await bob.get(`/community/post/${seed.first}`); expect(web.status()).toBe(200); expect(await web.text()).toContain("Post deleted by author");
  await page.screenshot({ path: "artifacts/feed-tools-real-deleted-thread.png" });
});
