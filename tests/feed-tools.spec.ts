import { test, expect, type Page, type Route } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { source, official, user, neighbour, uid, postId, quoteId, stamp } from "./discussion-data";
const origin = process.env.SURIOS_TEST_API_ORIGIN || "https://mobile-api.surios.test";
const token = `surios_mobile_${"c".repeat(64)}`;
const social = () => ({ ...official(), id: uid(30), author: { ...user }, body: "Demo social share of the official update.", governmentUpdate: null });
type Quote = ReturnType<typeof official> | ReturnType<typeof social>;
type Model = { posts: ReturnType<typeof source>[]; quotes: Quote[]; reads: URL[]; deletes: string[] };
async function json(route: Route, value: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", headers: {
    "Access-Control-Allow-Origin": "http://localhost:8082", "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE",
  }, body: JSON.stringify(value) });
}
async function fixture(page: Page, handle?: (route: Route, url: URL, model: Model) => Promise<boolean>) {
  const first = { ...source(), userConfirmed: true };
  const bridge = { ...source(uid(51)), title: "Demo bridge railings", reportSeverity: 8, reportRiskLevel: "CRITICAL", userConfirmed: false };
  const other = { ...source(uid(52)), title: "Demo canal blockage", author: { ...user, ...neighbour, email: "private-neighbour@example.test" } };
  const model: Model = { posts: [first, bridge, other], quotes: [{ ...official(), userLiked: true }, social()], reads: [], deletes: [] };
  const image = await readFile("assets/images/icon.png");
  await page.route(`${origin}/media/**`, route => route.fulfill({ contentType: "image/png", body: image }));
  const entries = () => [
    ...model.posts.filter(p => !p.deletedAt).map(post => ({ kind: "post" as const, post })),
    ...model.quotes.map(repost => ({ kind: "repost" as const, repost })),
  ];
  const ownProfile = (id: string, pageNumber: number) => {
    const office = model.quotes[0].author;
    const account = id === user.id ? user : id === neighbour.id ? neighbour : office;
    const feed = entries().filter(e => (e.kind === "post" ? e.post.author.id : e.repost.author.id) === id);
    return { profile: { ...account, email: id === user.id ? user.email : "private-neighbour@example.test", avatarUrl: "/media/avatar.png", coverUrl: "/media/cover.png",
      governmentProfile: id === office.id ? { level: "MUNICIPAL", jurisdiction: "Santa Cruz, Laguna", bio: "Demo public infrastructure office." } : null },
      isOwner: id === user.id, statistics: id === office.id ? { reports: 1, inProgress: 0, resolved: 1 } : null,
      total: feed.length, feed: feed.slice(0, pageNumber * 2), hasMore: feed.length > pageNumber * 2, currentPage: pageNumber };
  };
  await page.route(`${origin}/api/**`, async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    if (req.method() === "OPTIONS") return json(route, null);
    if (await handle?.(route, url, model)) return;
    if (path === "/api/auth/login") return json(route, { accessToken: token, tokenType: "Bearer", expiresAt: "2099-01-01T00:00:00Z", user });
    if (path === "/api/auth/session") return json(route, { expiresAt: "2099-01-01T00:00:00Z", user });
    expect(req.headers().authorization).toBe(`Bearer ${token}`);
    expect(req.headers().cookie).toBeUndefined();
    if (path === "/api/auth/logout") return json(route, { success: true });
    if (path === "/api/community/posts" && req.method() === "GET") {
      model.reads.push(url);
      let feed = entries();
      const q = url.searchParams.get("q")?.toLowerCase(), tab = url.searchParams.get("tab"), media = url.searchParams.get("media");
      if (q) feed = feed.filter(e => { const p = e.kind === "post" ? e.post : e.repost.post; const a = e.kind === "post" ? e.post.author : e.repost.author; return `${p.title} ${p.body} ${p.locationName} ${a.name}`.toLowerCase().includes(q); });
      if (tab === "liked") feed = feed.filter(e => e.kind === "post" ? e.post.userConfirmed : e.repost.userLiked);
      if (tab === "critical") feed = feed.filter(e => (e.kind === "post" ? e.post : e.repost.post).reportSeverity >= 8);
      if (media) feed = feed.filter(e => (e.kind === "post" ? e.post : e.repost.post).media.some(m => m.kind === media));
      const currentPage = Number(url.searchParams.get("page") || 1);
      return json(route, { feed: feed.slice(0, currentPage * 2), total: feed.length, hasMore: feed.length > currentPage * 2, currentPage });
    }
    if (path === "/api/profile") return json(route, ownProfile(user.id, Number(url.searchParams.get("page") || 1)));
    if (path.startsWith("/api/profiles/")) return json(route, ownProfile(path.split("/").at(-1)!, Number(url.searchParams.get("page") || 1)));
    if (req.method() === "DELETE") {
      model.deletes.push(req.url());
      if (path === "/api/community/reposts") {
        model.quotes = model.quotes.filter(q => q.id !== url.searchParams.get("id"));
        return json(route, { removed: true });
      }
      const p = model.posts.find(p => path.endsWith(p.id))!;
      Object.assign(p, { title: "Post deleted by author", body: "", media: [], deletedAt: stamp, deleted: true });
      return json(route, { deleted: true, retainedHazard: true });
    }
    if (path.startsWith("/api/community/posts/")) {
      const p = model.posts.find(p => path.endsWith(p.id)) || source(path.split("/").at(-1));
      if (req.method() === "POST") {
        p.userConfirmed = req.postDataJSON().liked;
        p.confirmations = p.userConfirmed ? 1 : 0;
        return json(route, { userConfirmed: p.userConfirmed, confirmations: p.confirmations });
      }
      return json(route, { post: p, reposts: model.quotes });
    }
    return json(route, { message: "Not found" }, 404);
  });
  return model;
}
async function login(page: Page) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email address" }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("FixturePassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Demo drainage cover report", exact: true })).toBeVisible();
}
const failures = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => { const errors: string[] = []; failures.set(page, errors); page.on("pageerror", e => errors.push(e.message)); });
test.afterEach(({ page }) => { expect(failures.get(page)).toEqual([]); });

test("search reaches the server, hides the composer, counts matches and clears cleanly", async ({ page }) => {
  const model = await fixture(page); await login(page);
  await page.getByRole("textbox", { name: "Search community" }).fill("  bridge  ");
  await page.getByRole("button", { name: "Search posts", exact: true }).click();
  await expect(page.getByText("1 result for “bridge”", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo bridge railings", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start a community infrastructure report" })).toHaveCount(0);
  expect(model.reads.at(-1)?.searchParams.get("q")).toBe("bridge");
  expect(model.reads.at(-1)?.searchParams.get("sort")).toBe("relevance");
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start a community infrastructure report" })).toBeVisible();
});

test("media, critical and sort controls reset cumulative paging without duplicate cards", async ({ page }) => {
  const model = await fixture(page); await login(page);
  await page.getByRole("button", { name: "Load more reports", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Demo canal blockage" })).toBeVisible();
  expect(model.reads.at(-1)?.searchParams.get("page")).toBe("2");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("radio", { name: "Photos", exact: true }).click();
  await page.getByRole("radio", { name: "Most liked", exact: true }).click();
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect.poll(() => model.reads.at(-1)?.searchParams.get("media")).toBe("photo");
  expect(model.reads.at(-1)?.searchParams.get("page")).toBe("1");
  expect(model.reads.at(-1)?.searchParams.get("sort")).toBe("likes");
  await expect(page.getByRole("heading", { name: "Demo drainage cover report", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Critical", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Demo bridge railings", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo drainage cover report", exact: true })).toHaveCount(0);
});

test("Liked posts shows only saved source/update likes and no competing feed tabs", async ({ page }) => {
  const model = await fixture(page); await login(page);
  await page.getByRole("button", { name: "Liked posts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Liked posts", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Government update", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo bridge railings", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Critical", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "All updates", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start a community infrastructure report" })).toHaveCount(0);
  expect(model.reads.at(-1)?.searchParams.get("tab")).toBe("liked");
  await page.getByRole("textbox", { name: "Search liked posts" }).fill("no match");
  await page.getByRole("button", { name: "Search posts", exact: true }).click();
  await expect(page.getByText("No liked posts found", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to community feed" }).click();
  await expect(page.getByRole("button", { name: "All updates", exact: true })).toBeVisible();
});

test("a delayed old search cannot replace a newer search and failures retain the exact retry query", async ({ page }) => {
  let finish!: () => void; const hold = new Promise<void>(resolve => { finish = resolve; });
  let fail = true;
  await fixture(page, async (route, url) => {
    if (url.searchParams.get("q") === "slow") { await hold; await json(route, { feed: [], total: 0, currentPage: 1, hasMore: false }); return true; }
    if (url.searchParams.get("q") === "bridge" && fail) { await json(route, { message: "Demo search temporarily unavailable" }, 503); return true; }
    return false;
  }); await login(page);
  await page.getByRole("textbox", { name: "Search community" }).fill("slow");
  await page.getByRole("button", { name: "Search posts", exact: true }).click();
  await page.getByRole("textbox", { name: "Search community" }).fill("bridge");
  await page.getByRole("button", { name: "Search posts", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Demo search temporarily unavailable");
  await expect(page.getByRole("textbox", { name: "Search community" })).toHaveValue("bridge");
  finish(); fail = false;
  await page.getByRole("button", { name: "Retry loading reports" }).click();
  await expect(page.getByRole("heading", { name: "Demo bridge railings", exact: true })).toBeVisible();
  await expect(page.getByText("1 result for “bridge”", { exact: true })).toBeVisible();
});

test("author taps open a public feed profile while Profile stays the signed-in user's account", async ({ page }) => {
  await fixture(page); await login(page);
  await page.getByRole("button", { name: "Load more reports", exact: true }).click();
  await page.getByRole("link", { name: `View profile of ${neighbour.name}`, exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("profile")).toBe(neighbour.id);
  await expect(page.getByRole("heading", { name: `Posts by ${neighbour.name}` })).toBeVisible();
  await expect(page.getByRole("img", { name: `${neighbour.name}'s cover photo` })).toBeVisible();
  await expect(page.getByText("private-neighbour@example.test", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit profile", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Home", exact: true }).getByText("Home", { exact: true })).toHaveCSS("color", "rgb(201, 61, 0)");
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByText(user.email, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit profile", exact: true })).toBeVisible();
});

test("office profiles show authoritative distinct-report statistics and errors never show another profile", async ({ page }) => {
  const model = await fixture(page, async (route, url) => {
    if (url.pathname.endsWith(uid(999))) { await json(route, { message: "Profile not found." }, 404); return true; }
    return false;
  }); await login(page);
  await page.goto(`/citizen?profile=${model.quotes[0].author.id}`);
  await expect(page.getByText("Demo public infrastructure office.", { exact: true })).toBeVisible();
  await expect(page.getByText("Reports handled", { exact: true })).toBeVisible();
  await expect(page.getByText("Distinct reports attributed to this office’s latest official updates.")).toBeVisible();
  await page.goto(`/citizen?profile=${uid(999)}`);
  await expect(page.getByRole("alert")).toHaveText("Profile not found.");
  await expect(page.getByText("Demo public infrastructure office.", { exact: true })).toHaveCount(0);
  await page.goto("/citizen?profile=invalid");
  await expect(page.getByRole("alert")).toHaveText("Profile not found.");
});

test("own deletion requires confirmation, prevents duplicate requests and refreshes saved feed", async ({ page }) => {
  let finish!: () => void; const hold = new Promise<void>(resolve => { finish = resolve; });
  const model = await fixture(page, async (route) => { if (route.request().method() === "DELETE") await hold; return false; });
  await login(page);
  await page.getByRole("button", { name: "More options for your post", exact: true }).first().click();
  await page.getByRole("button", { name: "Delete post", exact: true }).click();
  await page.getByRole("button", { name: "Cancel deletion" }).click();
  expect(model.deletes).toHaveLength(0);
  await page.getByRole("button", { name: "Delete post", exact: true }).click();
  await expect(page.getByText(/The linked hazard, other people’s reports/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm delete post", exact: true }).click();
  await expect(page.getByRole("button", { name: "Deleting…", exact: true })).toBeDisabled();
  finish();
  await expect(page.getByRole("heading", { name: "Demo drainage cover report", exact: true })).toHaveCount(0);
  expect(model.deletes).toHaveLength(1);
  expect(new URL(model.deletes[0]).pathname).toBe(`/api/community/posts/${postId}`);
});

test("deletion failure keeps the post and lets the user cancel or retry", async ({ page }) => {
  let reject = true;
  await fixture(page, async (route) => {
    if (route.request().method() === "DELETE" && reject) { await json(route, { message: "You do not own this post." }, 403); return true; }
    return false;
  }); await login(page);
  await page.getByRole("button", { name: "More options for your post", exact: true }).first().click();
  await page.getByRole("button", { name: "Delete post", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete post", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("You do not own this post.");
  await expect(page.getByRole("button", { name: "Confirm delete post", exact: true })).toBeEnabled();
  reject = false;
  await page.getByRole("button", { name: "Confirm delete post", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Demo drainage cover report", exact: true })).toHaveCount(0);
});

test("social repost deletion uses its own record and official updates offer no delete control", async ({ page }) => {
  const model = await fixture(page); await login(page);
  await page.getByRole("button", { name: "Load more reports", exact: true }).click();
  await page.getByRole("button", { name: "Load more reports", exact: true }).click();
  await expect(page.getByRole("button", { name: "More options for your repost", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "More options for your repost", exact: true }).click();
  await page.getByRole("button", { name: "Delete repost", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete repost", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Shared report", exact: true })).toHaveCount(0);
  const request = new URL(model.deletes[0]);
  expect(request.pathname).toBe("/api/community/reposts"); expect(request.searchParams.get("id")).toBe(uid(30));
  await page.goto(`/post/${postId}?repost=${quoteId}`);
  await expect(page.getByText("Demo official repair progress and evidence.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /More options for your/ })).toHaveCount(0);
});

test("detail deletion retains the hazard and official explanation and author links remain native", async ({ page }) => {
  await fixture(page); await login(page); await page.goto(`/post/${postId}`);
  await page.getByRole("button", { name: "More options for your post", exact: true }).click();
  await page.getByRole("button", { name: "Delete post", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete post", exact: true }).click();
  await expect(page.getByText("The author deleted the original post. The hazard and official response history are retained.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "View official resolution", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "More options for your post", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: `View profile of ${user.name}`, exact: true }).first().click();
  await expect(page.getByRole("heading", { name: `Posts by ${user.name}` })).toBeVisible();
});

test("controls and contributor views fit small phones, landscape and large text in light appearance", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await fixture(page); await login(page);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(page.getByRole("button", { name: "Apply filters", exact: true })).toBeInViewport();
  await page.screenshot({ path: "artifacts/feed-tools-filters-mobile.png" });
  await page.getByRole("button", { name: "Close Feed filters", exact: true }).click();
  await page.goto(`/citizen?profile=${neighbour.id}`);
  await expect(page.getByRole("heading", { name: `Posts by ${neighbour.name}` })).toBeVisible();
  await page.screenshot({ path: "artifacts/feed-tools-contributor-mobile.png" });
  await page.setViewportSize({ width: 812, height: 375 });
  await page.addStyleTag({ content: "[dir='auto'] { font-size: 22px !important; line-height: 30px !important; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("public pagination and back navigation preserve the searched feed and own-account boundary", async ({ page }) => {
  await fixture(page); await login(page);
  await page.getByRole("textbox", { name: "Search community" }).fill("bridge");
  await page.getByRole("button", { name: "Search posts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Demo bridge railings", exact: true })).toBeVisible();
  await page.getByRole("link", { name: `View profile of ${user.name}`, exact: true }).click();
  await expect(page.getByRole("heading", { name: `Posts by ${user.name}` })).toBeVisible();
  await page.getByRole("button", { name: "Load more contributor posts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Shared report", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo drainage cover report", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Edit profile", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Back to community feed", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Search community" })).toHaveValue("bridge");
  await expect(page.getByText("1 result for “bridge”", { exact: true })).toBeVisible();
});

test("own profile deletion refreshes the persisted post count and leaves its editor usable", async ({ page }) => {
  await fixture(page); await login(page);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByText("3 posts", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "More options for your post", exact: true }).first().click();
  await page.getByRole("button", { name: "Delete post", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete post", exact: true }).click();
  await expect(page.getByText("2 posts", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo drainage cover report", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit profile", exact: true })).toBeEnabled();
});

test("an incomplete deletion receipt never removes the card or reports success", async ({ page }) => {
  await fixture(page, async route => {
    if (route.request().method() === "DELETE") { await json(route, { deleted: true }); return true; }
    return false;
  }); await login(page);
  await page.getByRole("button", { name: "More options for your post", exact: true }).first().click();
  await page.getByRole("button", { name: "Delete post", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete post", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("The server did not confirm deletion");
  await page.getByRole("button", { name: "Close Delete this post?", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Demo drainage cover report", exact: true })).toBeVisible();
});

test("official authors still cannot delete their own government update", async ({ page }) => {
  const account = { ...user, id: uid(12), role: "OFFICER" };
  await fixture(page, async (route, url) => {
    if (url.pathname === "/api/auth/login") { await json(route, { accessToken: token, tokenType: "Bearer", expiresAt: "2099-01-01T00:00:00Z", user: account }); return true; }
    if (url.pathname === "/api/auth/session") { await json(route, { expiresAt: "2099-01-01T00:00:00Z", user: account }); return true; }
    return false;
  }); await login(page); await page.goto(`/post/${postId}?repost=${quoteId}`);
  await expect(page.getByText("Demo official repair progress and evidence.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /More options for your/ })).toHaveCount(0);
});

test("a confirmed delete removes private post contents even when its refresh fails", async ({ page }) => {
  await fixture(page, async (route, url, model) => {
    if (route.request().method() === "GET" && url.pathname === `/api/community/posts/${postId}` && model.deletes.length) {
      await json(route, { message: "Demo refresh temporarily unavailable" }, 503); return true;
    }
    return false;
  }); await login(page); await page.goto(`/post/${postId}`);
  await page.getByRole("button", { name: "More options for your post", exact: true }).click();
  await page.getByRole("button", { name: "Delete post", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete post", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Demo refresh temporarily unavailable");
  await expect(page.getByRole("heading", { name: "Post deleted by author", exact: true })).toBeVisible();
  await expect(page.getByText("Demo full report description with public access context.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "View official resolution", exact: true })).toBeVisible();
});

test("every media and sort choice reaches the server and the sheet retains selected values", async ({ page }) => {
  const model = await fixture(page); await login(page);
  for (const item of [
    { media: "video", mediaLabel: "Videos", sort: "oldest", sortLabel: "Oldest first" },
    { media: "photo", mediaLabel: "Photos", sort: "severity", sortLabel: "Highest severity" },
    { media: "all", mediaLabel: "All media", sort: "likes", sortLabel: "Most liked" },
    { media: "all", mediaLabel: "All media", sort: "newest", sortLabel: "Newest first" },
  ]) {
    await page.getByRole("button", { name: /^Filters(?: applied)?$/ }).click();
    await page.getByRole("radio", { name: item.mediaLabel, exact: true }).click();
    await page.getByRole("radio", { name: item.sortLabel, exact: true }).click();
    await page.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect.poll(() => model.reads.at(-1)?.searchParams.get("sort")).toBe(item.sort);
    expect(model.reads.at(-1)?.searchParams.get("media")).toBe(item.media === "all" ? null : item.media);
    await page.getByRole("button", { name: /^Filters(?: applied)?$/ }).click();
    await expect(page.getByRole("radio", { name: item.mediaLabel, exact: true })).toBeChecked();
    await expect(page.getByRole("radio", { name: item.sortLabel, exact: true })).toBeChecked();
    await page.getByRole("button", { name: "Close Feed filters", exact: true }).click();
  }
  await page.getByRole("textbox", { name: "Search community" }).fill("bridge");
  await page.getByRole("button", { name: "Search posts", exact: true }).click();
  await page.getByRole("button", { name: /^Filters(?: applied)?$/ }).click();
  await expect(page.getByRole("radio", { name: "Most relevant", exact: true })).toBeChecked();
});
