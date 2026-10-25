import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
test.skip(
  process.env.SURIOS_TEST_DISCUSSION_LIVE !== "1",
  "Requires an isolated loopback SuriOS backend and disposable seed data.",
);
test.describe.configure({ mode: "serial" });
const origin = process.env.SURIOS_TEST_API_ORIGIN || "https://127.0.0.1:5189";
const password = "MobileProfileFixture123!";
const runId = Date.now();
const email = `mobile-discussion-${runId}@example.test`;
const citizenName = `Demo Discussion Citizen ${runId}`;
const sourceCommentText = `Demo real persisted comment ${runId}`;
const sourceReplyText = `Demo real persisted reply ${runId}`;
const socialBody = `Demo real social share of progress ${runId}`;
let baselineLikes = 0;
let api: APIRequestContext, other: APIRequestContext, office: APIRequestContext;
let seed: {
    first: string;
    sibling: string;
    other: string;
    hazard: string;
    unrelated: string;
  },
  oldUpdate = "",
  resolution = "",
  sourceComment = "",
  citizenId = "";
const digest = (b: Buffer) => createHash("sha256").update(b).digest("hex");
async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start a community infrastructure report", exact: true }),
  ).toBeVisible();
}
test.beforeAll(async ({ playwright }) => {
  if (process.env.SURIOS_TEST_DISCUSSION_LIVE !== "1") return;
  if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
    throw new Error("Discussion writes require an isolated loopback backend.");
  seed = JSON.parse(await readFile("artifacts/discussion-seed.json", "utf8"));
  const guest = await playwright.request.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
  });
  const register = async (address: string, name: string) => {
    const result = await guest.post("/api/auth/register", {
      data: { name, email: address, password, confirmPassword: password },
    });
    expect(result.status()).toBe(201);
    return result.json();
  };
  const a = await register(email, citizenName),
    b = await register(`second-${email}`, "Demo Other Discussion Citizen");
  citizenId = a.user.id;
  api = await playwright.request.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Authorization: `Bearer ${a.accessToken}` },
  });
  other = await playwright.request.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Authorization: `Bearer ${b.accessToken}` },
  });
  baselineLikes = (
    await (await api.get(`/api/community/posts/${seed.first}`)).json()
  ).post.confirmations;
  const login = await guest.post("/api/auth/login", {
    data: { email: "mobile-profile-office@example.test", password },
  });
  expect(login.status()).toBe(200);
  office = await playwright.request.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      Authorization: `Bearer ${(await login.json()).accessToken}`,
    },
  });
  const photo = await readFile("assets/images/icon.png");
  for (const status of ["IN_PROGRESS", "RESOLVED"]) {
    const id = randomUUID();
    const result = await office.post("/api/community/reposts", {
      multipart: {
        id,
        postId: seed.sibling,
        body:
          status === "RESOLVED"
            ? "Demo official resolution with repair evidence."
            : "Demo earlier official progress.",
        status,
        budgetType: "ACTUAL",
        budget: JSON.stringify([
          { label: "Demo cover replacement", amount: 1200.5 },
        ]),
        evidence: {
          name: "demo-official.png",
          mimeType: "image/png",
          buffer: photo,
        },
      },
    });
    expect(result.status()).toBe(201);
    if (status === "IN_PROGRESS") oldUpdate = id;
    else resolution = id;
  }
  await guest.dispose();
});
test.afterAll(async () => {
  for (const client of [api, other, office]) {
    if (client) {
      await client.post("/api/auth/logout");
      await client.dispose();
    }
  }
});

test("real mobile details persist comments/replies/likes and a second session reads the same discussion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto(`/post/${seed.first}`);
  await expect(
    page.getByRole("heading", {
      name: "Demo real mobile discussion",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your comment", exact: true })
    .fill(sourceCommentText);
  await page.getByRole("button", { name: "Send comment", exact: true }).click();
  await expect(
    page.getByText(sourceCommentText, { exact: true }),
  ).toBeVisible();
  let thread = await (
    await api.get(`/api/community/posts/${seed.first}`)
  ).json();
  sourceComment = thread.post.comments.find(
    (c: { body: string }) => c.body === sourceCommentText,
  ).id;
  await page
    .getByRole("button", {
      name: `Reply to ${citizenName}`,
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Your reply", exact: true })
    .fill(sourceReplyText);
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect(page.getByText(sourceReplyText, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Like post", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unlike post", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: `Like comment by ${citizenName}`,
      exact: true,
    })
    .first()
    .click();
  await expect(
    page.getByRole("button", {
      name: `Unlike comment by ${citizenName}`,
      exact: true,
    }),
  ).toHaveCount(1);
  await page.reload();
  await expect(page.getByText(sourceReplyText, { exact: true })).toBeVisible();
  thread = await (await other.get(`/api/community/posts/${seed.first}`)).json();
  expect(thread.post.confirmations).toBe(baselineLikes + 1);
  expect(thread.post.userConfirmed).toBe(false);
  expect(
    thread.post.comments.find(
      (c: { body: string }) => c.body === sourceReplyText,
    ).parentId,
  ).toBe(sourceComment);
  expect(
    thread.post.comments
      .filter((c: { author: { id: string } }) => c.author.id === citizenId)
      .reduce((sum: number, c: { likes: number }) => sum + c.likes, 0),
  ).toBe(1);
  const web = await other.get(`/community/post/${seed.first}`);
  expect(web.status()).toBe(200);
  expect(await web.text()).toContain(sourceCommentText);
  await page.screenshot({
    path: "artifacts/discussion-real-backend-mobile.png",
    fullPage: true,
  });
});
test("real linked official updates preserve historical state and separate quote comments/reactions from original reports", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto(`/post/${seed.sibling}?repost=${oldUpdate}`);
  await expect(
    page.getByText("Status when published: In progress", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Resolved", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Total: ₱1,200.50", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/discussion-official-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "View photo: demo-official.png", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Evidence", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close Evidence", exact: true })
    .click();
  await page.getByRole("button", { name: "Like post", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unlike post", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your comment", exact: true })
    .fill("Demo real update discussion");
  await page.getByRole("button", { name: "Send comment", exact: true }).click();
  await expect(
    page.getByText("Demo real update discussion", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: `Reply to ${citizenName}`,
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Your reply", exact: true })
    .fill("Demo real update reply");
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect(
    page.getByText("Demo real update reply", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: `Like comment by ${citizenName}`,
      exact: true,
    })
    .first()
    .click();
  await expect(
    page.getByRole("button", {
      name: `Unlike comment by ${citizenName}`,
      exact: true,
    }),
  ).toHaveCount(1);
  const update = (
    await (await other.get(`/api/community/reposts/${oldUpdate}`)).json()
  ).repost;
  expect(update.likes).toBe(1);
  expect(update.userLiked).toBe(false);
  expect(update.comments).toHaveLength(2);
  expect(
    update.comments.reduce(
      (sum: number, c: { likes: number }) => sum + c.likes,
      0,
    ),
  ).toBe(1);
  const post = (
    await (await api.get(`/api/community/posts/${seed.sibling}`)).json()
  ).post;
  expect(post.confirmations).toBe(0);
  expect(post.comments).toHaveLength(0);
  expect(post.reportSeverity).toBe(3);
  await page.screenshot({
    path: "artifacts/discussion-official-comments-mobile.png",
    fullPage: true,
  });
});
test("real repost uploads exact image bytes, retries idempotently, quotes the update and appears in the saved profile/feed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto(`/post/${seed.sibling}?repost=${oldUpdate}`);
  await page.getByRole("button", { name: "Repost", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Add a message (optional)", exact: true })
    .fill(socialBody);
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Add image (optional)", exact: true })
    .click();
  await (await chooser).setFiles("assets/images/icon.png");
  await expect(
    page.getByRole("button", { name: "Publish repost", exact: true }),
  ).toBeEnabled();
  const response = page.waitForResponse(
    (r) =>
      r.url() === `${origin}/api/community/reposts` &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Publish repost", exact: true })
    .click();
  const savedResponse = await response;
  expect(savedResponse.status()).toBe(201);
  const saved = await savedResponse.json();
  await expect(page.getByRole("status")).toHaveText("Repost published.");
  const quote = (
    await (await api.get(`/api/community/reposts/${saved.id}`)).json()
  ).repost;
  expect(quote.body).toBe(socialBody);
  expect(quote.quotedRepostId).toBe(oldUpdate);
  expect(quote.governmentUpdate).toBeNull();
  expect(quote.media).toHaveLength(1);
  const bytes = await api.get(quote.media[0].url);
  expect(bytes.status()).toBe(200);
  expect(digest(await bytes.body())).toBe(
    digest(await readFile("assets/images/icon.png")),
  );
  const retry = await api.post("/api/community/reposts", {
    multipart: {
      id: saved.id,
      postId: seed.sibling,
      quotedRepostId: oldUpdate,
      body: quote.body,
    },
  });
  expect(retry.status()).toBe(201);
  expect((await retry.json()).id).toBe(saved.id);
  const feed = await (
    await api.get(`/api/community/posts?author=${citizenId}`)
  ).json();
  expect(
    feed.reposts.filter((r: { id: string }) => r.id === saved.id),
  ).toHaveLength(1);
  await page.goto(`/post/${seed.sibling}?repost=${saved.id}`);
  await expect(
    page.getByText(socialBody, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open quoted update", exact: true }),
  ).toBeVisible();
  await page.goto("/profile");
  await expect(
    page.getByText(socialBody, { exact: true }),
  ).toBeVisible();
});
test("canonical resolutions stay shared across linked observations while unrelated hazards and severity stay independent", async () => {
  for (const id of [seed.first, seed.sibling]) {
    const thread = await (await api.get(`/api/community/posts/${id}`)).json();
    expect(thread.post.reportStatus).toBe("RESOLVED");
    expect(thread.post.reportSeverity).toBe(3);
    expect(thread.post.governmentUpdateLink).toContain(resolution);
  }
  const unrelated = await (
    await api.get(`/api/community/posts/${seed.other}`)
  ).json();
  expect(unrelated.post.reportStatus).toBe("REPORTED");
  expect(unrelated.post.governmentUpdateLink).toBeNull();
  expect(unrelated.reposts).toHaveLength(0);
  const invalidParent = await api.post(`/api/community/posts/${seed.other}`, {
    data: {
      action: "comment",
      body: "Demo invalid cross-post reply",
      parentId: sourceComment,
    },
  });
  expect(invalidParent.status()).toBe(400);
  const invalidQuoteParent = await api.post(
    `/api/community/reposts/${oldUpdate}`,
    {
      data: {
        action: "comment",
        body: "Demo invalid cross-discussion reply",
        parentId: sourceComment,
      },
    },
  );
  expect(invalidQuoteParent.status()).toBe(400);
});
