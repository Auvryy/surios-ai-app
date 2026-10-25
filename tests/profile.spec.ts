import { test, expect, type Page, type Route } from "@playwright/test";
import type { UserRole } from "../src/auth/contracts";

const origin = process.env.SURIOS_TEST_API_ORIGIN || "https://mobile-api.surios.test";
const token = `surios_mobile_${"a".repeat(64)}`;
const id = "7f66c73b-d78e-43c2-a84d-97c77c2eb2df";
const password = "DemoPassword123!";
type Model = {
  name: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  office: { level: string; jurisdiction: string; bio: string } | null;
  writes: FormData[];
  reads: number[];
};
declare global {
  interface Window { profileUploadFiles?: { field: string; type: string; size: number }[] }
}

async function json(route: Route, value: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", headers: {
    "Access-Control-Allow-Origin": "http://localhost:8082",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE",
  }, body: JSON.stringify(value) });
}
async function multipart(route: Route) {
  return new Response(new Uint8Array(route.request().postDataBuffer()!), {
    headers: { "Content-Type": route.request().headers()["content-type"] },
  }).formData();
}
async function fixture(page: Page, options: {
  role?: UserRole;
  photos?: boolean;
  empty?: boolean;
  pagination?: boolean;
  handle?: (route: Route, path: string, model: Model) => Promise<boolean>;
} = {}) {
  const role = options.role || "CITIZEN";
  const model: Model = {
    name: "Demo Alex Cruz", avatarUrl: options.photos ? "/media/avatar.png" : null,
    coverUrl: options.photos ? "/media/cover.png" : null, writes: [], reads: [],
    office: role === "CITIZEN" ? null : { level: "MUNICIPAL", jurisdiction: "Santa Cruz, Laguna", bio: "Demo public infrastructure office." },
  };
  const user = () => ({ id, name: model.name, email: "demo-alex@example.test", avatarUrl: model.avatarUrl, role, accountStatus: "ACTIVE" });
  const profile = () => ({ id, name: model.name, avatarUrl: model.avatarUrl, coverUrl: model.coverUrl, role, governmentProfile: model.office });
  const post = (key: string) => ({ kind: "post", post: {
    id: key, title: `Demo · My drainage report ${key}`, body: "Visible canal cover damage near a public walkway.",
    createdAt: "2026-10-25T00:00:00Z", author: { id, name: model.name, avatarUrl: model.avatarUrl },
    media: [], reportId: "demo-hazard", reportStatus: "RESOLVED", locationName: "Santa Cruz, Laguna",
    governmentUpdateLink: "/community/post/one?repost=demo-official",
  } });
  await page.route(`${origin}/media/**`, (route) => route.fulfill({ contentType: "image/png", path: "assets/images/icon.png" }));
  await page.route(`${origin}/api/**`, async (route) => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (request.method() === "OPTIONS") return json(route, null);
    if (await options.handle?.(route, path, model)) return;
    if (path === "/api/auth/login") return json(route, { accessToken: token, tokenType: "Bearer", user: user(), expiresAt: "2099-01-01T00:00:00Z" });
    if (path === "/api/auth/session") return json(route, { user: user(), expiresAt: "2099-01-01T00:00:00Z" });
    if (path === "/api/auth/logout") return json(route, { success: true });
    if (path === "/api/community/posts") return json(route, { feed: [{ ...post("community"), post: { ...post("community").post, title: "Demo · Community report" } }], currentPage: 1, hasMore: false });
    if (path === "/api/profile") {
      expect(request.headers().authorization).toBe(`Bearer ${token}`);
      expect(request.headers().cookie).toBeUndefined();
      if (request.method() === "POST") {
        const form = await multipart(route); model.writes.push(form);
        model.name = String(form.get("name"));
        if (form.get("removeAvatar") === "true") model.avatarUrl = null;
        if (form.get("removeCover") === "true") model.coverUrl = null;
        if (form.has("avatar")) model.avatarUrl = "/media/saved-avatar.png";
        if (form.has("cover")) model.coverUrl = "/media/saved-cover.png";
        if (form.has("governmentLevel")) model.office = { level: String(form.get("governmentLevel")), jurisdiction: String(form.get("jurisdiction")), bio: String(form.get("bio")) };
        return json(route, { profile: { id, name: model.name, avatarUrl: model.avatarUrl, coverUrl: model.coverUrl } });
      }
      const currentPage = Number(url.searchParams.get("page") || 1); model.reads.push(currentPage);
      return json(route, { profile: profile(), isOwner: true, statistics: model.office ? { reports: 8, inProgress: 3, resolved: 4 } : null,
        total: options.empty ? 0 : options.pagination ? 2 : 1,
        feed: options.empty ? [] : (options.pagination && currentPage > 1 ? ["one", "two"] : ["one"]).map(post),
        currentPage, hasMore: !!options.pagination && currentPage === 1 });
    }
    return json(route, { message: "Not found" }, 404);
  });
  return model;
}
async function login(page: Page) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email address" }).fill("demo-alex@example.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Community feed", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
}
async function edit(page: Page) {
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toBeVisible();
}
async function choose(page: Page, label: string, file: string | { name: string; mimeType: string; buffer: Buffer }) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: label, exact: true }).click();
  await (await chooser).setFiles(file);
}

const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const list: string[] = []; errors.set(page, list);
  page.on("pageerror", (error) => list.push(error.message));
});
test.afterEach(({ page }) => { expect(errors.get(page)).toEqual([]); });

test("profile uses the authenticated server's identity and personal posts, with a protected reloadable route", async ({ page }) => {
  const model = await fixture(page, { photos: true }); await login(page);
  await expect(page.getByRole("heading", { name: model.name, exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: `${model.name}'s cover photo`, exact: true })).toBeVisible();
  await expect(page.getByText("1 post", { exact: true })).toBeVisible();
  await expect(page.getByText("Demo · My drainage report one", { exact: true })).toBeVisible();
  await expect(page.getByText("Demo · Community report", { exact: true })).toHaveCount(0);
  await expect(page.getByText("demo-alex@example.test", { exact: true })).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByRole("button", { name: "Edit profile", exact: true })).toBeEnabled();
  await expect(page.getByText("Demo · My drainage report one", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});

test("editing a name persists through the API, refreshes session identity and survives reload", async ({ page }) => {
  const model = await fixture(page); await login(page); await edit(page);
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("  Demo Updated Citizen  ");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Profile updated.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo Updated Citizen", exact: true })).toBeVisible();
  expect(model.writes).toHaveLength(1);
  expect(model.writes[0].get("name")).toBe("Demo Updated Citizen");
  expect(model.writes[0].has("governmentLevel")).toBe(false);
  await page.reload();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Demo Updated Citizen", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to feed", exact: true }).click();
  await expect(page.getByText("Demo Updated Citizen", { exact: true })).toBeVisible();
});

test("invalid names stay local, and cancelling the editor never mutates the server", async ({ page }) => {
  const model = await fixture(page); await login(page); await edit(page);
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(" x ");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("between 2 and 80");
  expect(model.writes).toHaveLength(0);
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Unsaved Demo Name");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("heading", { name: model.name, exact: true })).toBeVisible();
  expect(model.writes).toHaveLength(0);
});

test("failed saves retain input and selected photos for a real retry", async ({ page }) => {
  let fail = true;
  const model = await fixture(page, { handle: async (route, path) => {
    if (fail && path === "/api/profile" && route.request().method() === "POST") { await json(route, { message: "Profile storage is temporarily unavailable." }, 503); return true; }
    return false;
  } });
  await login(page); await edit(page);
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Demo Retained Name");
  await choose(page, "Choose profile picture", "assets/images/icon.png");
  await expect(page.getByRole("button", { name: "Remove profile picture", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("temporarily unavailable");
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Demo Retained Name");
  await expect(page.getByRole("button", { name: "Remove profile picture", exact: true })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Profile updated.", { exact: true })).toBeVisible();
  expect(model.writes[0].get("avatar")).toBeInstanceOf(File);
  expect(model.name).toBe("Demo Retained Name");
});

test("saving disables duplicate submission, editing and dismissal until confirmed", async ({ page }) => {
  let release!: () => void; const held = new Promise<void>((resolve) => { release = resolve; }); let calls = 0;
  await fixture(page, { handle: async (route, path) => {
    if (path === "/api/profile" && route.request().method() === "POST") { calls++; await held; }
    return false;
  } });
  await login(page); await edit(page);
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Demo Save Once");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saving…", exact: true })).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).not.toBeEditable();
  await expect(page.getByRole("button", { name: "Close Edit profile", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  expect(calls).toBe(1); release();
  await expect(page.getByRole("heading", { name: "Demo Save Once", exact: true })).toBeVisible();
  expect(calls).toBe(1);
});

test("avatar and cover selections are previewed and uploaded together as real multipart files", async ({ page }) => {
  await page.addInitScript(() => {
    const transport = window.fetch;
    window.fetch = (input, init) => {
      if (init?.method === "POST" && new URL(String(input)).pathname === "/api/profile" && init.body instanceof FormData)
        window.profileUploadFiles = [...init.body.entries()].filter((entry): entry is [string, File] => entry[1] instanceof File)
          .map(([field, file]) => ({ field, size: file.size, type: file.type }));
      return transport(input, init);
    };
  });
  const model = await fixture(page); await login(page); await edit(page);
  await choose(page, "Choose profile picture", "assets/images/icon.png");
  await expect(page.getByRole("button", { name: "Remove profile picture", exact: true })).toBeVisible();
  await choose(page, "Choose cover photo", "assets/images/icon.png");
  await expect(page.getByRole("img", { name: "Cover preview", exact: true })).toBeVisible();
  expect(model.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Profile updated.", { exact: true })).toBeVisible();
  const form = model.writes[0];
  for (const key of ["avatar", "cover"]) {
    const photo = form.get(key) as File;
    expect(photo).toBeInstanceOf(File); expect(photo.type).toBe("image/png");
  }
  // Chromium interception omits multipart file bytes from postDataBuffer; inspect the actual outgoing FormData too.
  const uploaded = await page.evaluate(() => window.profileUploadFiles);
  expect(uploaded?.map((photo) => photo.field)).toEqual(["avatar", "cover"]);
  expect(uploaded?.every((photo) => photo.size > 0 && photo.type === "image/png")).toBe(true);
  await expect(page.getByRole("img", { name: `${model.name}'s cover photo`, exact: true })).toBeVisible();
});

test("photo removal sends explicit flags without reuploading removed selections", async ({ page }) => {
  const model = await fixture(page, { photos: true }); await login(page); await edit(page);
  await choose(page, "Choose profile picture", "assets/images/icon.png");
  await page.getByRole("button", { name: "Remove profile picture", exact: true }).click();
  await page.getByRole("button", { name: "Remove cover photo", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Profile updated.", { exact: true })).toBeVisible();
  expect(model.writes[0].get("removeAvatar")).toBe("true");
  expect(model.writes[0].get("removeCover")).toBe("true");
  expect(model.writes[0].has("avatar")).toBe(false); expect(model.writes[0].has("cover")).toBe(false);
  await expect(page.getByRole("img", { name: `${model.name}'s cover photo`, exact: true })).toHaveCount(0);
  expect(model.avatarUrl).toBeNull(); expect(model.coverUrl).toBeNull();
});

test("cover and avatar camera controls save directly through the same authenticated API", async ({ page }) => {
  const model = await fixture(page); await login(page);
  await choose(page, "Change cover photo", "assets/images/icon.png");
  await expect(page.getByText("Cover photo updated.", { exact: true })).toBeVisible();
  expect(model.writes[0].get("cover")).toBeInstanceOf(File);
  await choose(page, "Change profile picture", "assets/images/icon.png");
  await expect(page.getByText("Profile picture updated.", { exact: true })).toBeVisible();
  expect(model.writes[1].get("avatar")).toBeInstanceOf(File);
  expect(model.writes).toHaveLength(2);
});

test("unsupported and oversized photos do not replace existing photos or reach the API", async ({ page }) => {
  const model = await fixture(page, { photos: true }); await login(page); await edit(page);
  // A genuine tiny GIF, so ImagePicker can read it before the profile-specific format check.
  await choose(page, "Choose profile picture", { name: "demo.gif", mimeType: "image/gif", buffer: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64") });
  await expect(page.getByRole("alert")).toContainText("JPEG, PNG, or WebP");
  const small = await import("node:fs/promises").then((fs) => fs.readFile("assets/images/icon.png"));
  const large = Buffer.concat([small, Buffer.alloc(4 * 1024 * 1024 + 1 - small.length)]);
  await choose(page, "Choose cover photo", { name: "large-demo.png", mimeType: "image/png", buffer: large });
  await expect(page.getByRole("alert")).toContainText("4 MB or less");
  expect(model.writes).toHaveLength(0);
  await expect(page.getByRole("img", { name: "Cover preview", exact: true })).toHaveAttribute("src", `${origin}/media/cover.png`);
});

test("government accounts edit office details and see distinct-report statistics from the backend", async ({ page }) => {
  const model = await fixture(page, { role: "OFFICER" }); await login(page);
  await expect(page.getByText("Municipal office · Santa Cruz, Laguna", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Reports handled: 8", { exact: true })).toBeVisible();
  await expect(page.getByLabel("In progress: 3", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Resolved: 4", { exact: true })).toBeVisible();
  await edit(page);
  await page.getByRole("button", { name: "Barangay", exact: true }).click();
  await page.getByRole("textbox", { name: "Jurisdiction", exact: true }).fill("Demo Barangay");
  await page.getByRole("textbox", { name: "About this office", exact: true }).fill("Demo maintenance office.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Barangay office · Demo Barangay", { exact: true })).toBeVisible();
  await expect(page.getByText("Demo maintenance office.", { exact: true })).toBeVisible();
  expect(model.writes[0].get("governmentLevel")).toBe("BARANGAY");
  expect(model.writes[0].get("jurisdiction")).toBe("Demo Barangay");
  expect(model.writes[0].get("bio")).toBe("Demo maintenance office.");
});

test("profile pagination replaces cumulative pages and a failed load preserves the previous history", async ({ page }) => {
  let fail = true;
  const model = await fixture(page, { pagination: true, handle: async (route, path) => {
    if (fail && path === "/api/profile" && new URL(route.request().url()).searchParams.get("page") === "2") { await json(route, { message: "Temporary connection problem." }, 503); return true; }
    return false;
  } });
  await login(page);
  await page.getByRole("button", { name: "Load more posts", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Temporary connection");
  await expect(page.getByText("Demo · My drainage report one", { exact: true })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Retry loading profile", exact: true }).click();
  await expect(page.getByText("Demo · My drainage report two", { exact: true })).toBeAttached();
  await expect(page.getByText("Demo · My drainage report one", { exact: true })).toHaveCount(1);
  expect(model.reads).toEqual([1, 2]);
});

test("an empty profile offers real report creation instead of fabricated activity", async ({ page }) => {
  await fixture(page, { empty: true }); await login(page);
  await expect(page.getByText("0 posts", { exact: true })).toBeVisible();
  await expect(page.getByText("No posts yet.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Share an infrastructure update", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Headline", exact: true })).toBeVisible();
});

test("profile authorization expiry clears the session and prevents editing", async ({ page }) => {
  await fixture(page, { handle: async (route, path) => {
    if (path === "/api/profile") { await json(route, { message: "Session revoked" }, 401); return true; }
    return false;
  } });
  await login(page);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("surios.session.v1"))).toBeNull();
  await expect(page.getByRole("button", { name: "Edit profile", exact: true })).toHaveCount(0);
});

test("profile and edit sheet keep the light shadcn-style layout at phone, landscape and enlarged text sizes", async ({ page }) => {
  await fixture(page); await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" }); await login(page);
  for (const size of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 812, height: 375 }]) {
    await page.setViewportSize(size);
    await expect(page.getByRole("button", { name: "Edit profile", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await edit(page);
    await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/profile-mobile.png", fullPage: true });
  await edit(page);
  await page.screenshot({ path: "artifacts/profile-editor-mobile.png", fullPage: true });
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toHaveCSS("background-color", "rgb(201, 61, 0)");
  await page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>("div, span, input")) {
      if (element.children.length) continue;
      const style = getComputedStyle(element), font = parseFloat(style.fontSize), line = parseFloat(style.lineHeight);
      element.style.fontSize = `${font * 1.5}px`;
      if (Number.isFinite(line)) element.style.lineHeight = `${line * 1.5}px`;
    }
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
