import { test, expect, type Page, type Route } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  comment,
  source,
  official,
  user,
  uid,
  postId,
  siblingId,
  quoteId,
  stamp,
} from "./discussion-data";
const origin =
  process.env.SURIOS_TEST_API_ORIGIN || "https://mobile-api.surios.test";
const token = `surios_mobile_${"b".repeat(64)}`;
type Model = {
  post: ReturnType<typeof source>;
  quote: ReturnType<typeof official>;
  requests: { path: string; body: unknown }[];
  sequence: number;
  reads: number;
};
async function json(route: Route, value: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "Access-Control-Allow-Origin": "http://localhost:8082",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE",
    },
    body: JSON.stringify(value),
  });
}
async function fixture(
  page: Page,
  options: {
    pending?: boolean;
    handle?: (route: Route, path: string, model: Model) => Promise<boolean>;
  } = {},
) {
  const model: Model = {
    post: source(),
    quote: official(),
    requests: [],
    sequence: 100,
    reads: 0,
  };
  const image = await readFile("assets/images/icon.png");
  await page.route(`${origin}/media/**`, (route) =>
    route.fulfill({ contentType: "image/png", body: image }),
  );
  await page.route(`${origin}/api/**`, async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (req.method() === "OPTIONS") return json(route, null);
    if (await options.handle?.(route, path, model)) return;
    const account = options.pending
      ? { ...user, role: "OFFICER", accountStatus: "PENDING" }
      : user;
    if (path === "/api/auth/login")
      return json(route, {
        accessToken: token,
        tokenType: "Bearer",
        expiresAt: "2099-01-01T00:00:00Z",
        user: account,
      });
    if (path === "/api/auth/session")
      return json(route, { expiresAt: "2099-01-01T00:00:00Z", user: account });
    expect(req.headers().authorization).toBe(`Bearer ${token}`);
    expect(req.headers().cookie).toBeUndefined();
    if (path === "/api/community/posts")
      return json(route, {
        feed: [{ kind: "post", post: model.post }],
        hasMore: false,
        currentPage: 1,
      });
    if (path === "/api/profile")
      return json(route, {
        profile: { ...user, coverUrl: null, governmentProfile: null },
        isOwner: true,
        statistics: null,
        total: 1,
        feed: [{ kind: "post", post: model.post }],
        hasMore: false,
        currentPage: 1,
      });
    if (
      req.method() === "GET" &&
      [postId, siblingId].some((id) => path === `/api/community/posts/${id}`)
    ) {
      model.reads++;
      return json(route, {
        post: path.endsWith(siblingId) ? model.quote.post : model.post,
        reposts: [model.quote],
      });
    }
    if (req.method() === "POST") {
      const body = req.headers()["content-type"]?.includes("application/json")
        ? req.postDataJSON()
        : req.postData();
      model.requests.push({ path, body });
      if (path === "/api/community/reposts") {
        const raw = String(body),
          id = /name="id"\r\n\r\n([^\r]+)/.exec(raw)?.[1];
        return json(
          route,
          { id, postId: raw.includes(siblingId) ? siblingId : postId },
          201,
        );
      }
      if (
        path === `/api/community/posts/${postId}` ||
        path === `/api/community/reposts/${quoteId}`
      ) {
        const input = req.postDataJSON(),
          quote = path.includes("/reposts/");
        if (input.action === "like") {
          if (quote) {
            model.quote.userLiked = input.liked;
            model.quote.likes = input.liked ? 1 : 0;
            return json(route, {
              likes: model.quote.likes,
              userLiked: input.liked,
            });
          }
          model.post.userConfirmed = input.liked;
          model.post.confirmations = input.liked ? 1 : 0;
          return json(route, {
            confirmations: model.post.confirmations,
            userConfirmed: input.liked,
          });
        }
        const saved = {
          ...comment(model.sequence++, input.body, input.parentId),
          author: user,
          createdAt: stamp,
        };
        (quote ? model.quote.comments : model.post.comments).push(saved);
        return json(route, quote ? { id: saved.id } : { comment: saved }, 201);
      }
      const commentId = path.split("/").at(-1),
        c = [...model.post.comments, ...model.quote.comments].find(
          (c) => c.id === commentId,
        );
      if (c) {
        c.userLiked = req.postDataJSON().liked;
        c.likes = c.userLiked ? 1 : 0;
        return json(
          route,
          path.includes("/reposts/")
            ? { userLiked: c.userLiked }
            : { userLiked: c.userLiked, likes: c.likes },
        );
      }
    }
    return json(route, { message: "Not found" }, 404);
  });
  return model;
}
async function authenticate(page: Page) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email address" }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("DemoPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start a community infrastructure report", exact: true }),
  ).toBeVisible();
}
async function open(page: Page) {
  await authenticate(page);
  await page.getByRole("link", { name: "Open post", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Demo drainage cover report",
      exact: true,
    }),
  ).toBeVisible();
}
async function write(page: Page, text: string, reply = false) {
  if (!reply)
    await page
      .getByRole("button", { name: "Add comment", exact: true })
      .click();
  await page
    .getByRole("textbox", {
      name: reply ? "Your reply" : "Your comment",
      exact: true,
    })
    .fill(text);
  await page
    .getByRole("button", {
      name: reply ? "Send reply" : "Send comment",
      exact: true,
    })
    .click();
}
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", (e) => list.push(e.message));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

test("feed and profile open native details, Back refreshes, and direct links restore the session", async ({
  page,
}) => {
  const model = await fixture(page);
  await open(page);
  await expect(page).toHaveURL(new RegExp(`/post/${postId}`));
  await expect(
    page
      .getByText("Demo full report description with public access context.")
      .filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start a community infrastructure report", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("link", { name: "Open post", exact: true }).click();
  await expect(
    page.getByText("Demo saved comment", { exact: true }),
  ).toBeVisible();
  await page.goto(`/post/${postId}`);
  await expect(
    page.getByRole("heading", {
      name: "Demo drainage cover report",
      exact: true,
    }),
  ).toBeVisible();
  expect(model.reads).toBeGreaterThanOrEqual(3);
});
test("details show current hazard state separately from original assessment and open photo/video evidence", async ({
  page,
}) => {
  await fixture(page);
  await open(page);
  await expect(
    page.getByText("Current severity 2/10", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View original assessment", exact: true })
    .click();
  await expect(page.getByText("Severity 3/10", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Demo original visual assessment.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View photo: Demo report photo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Evidence", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Next evidence", exact: true })
    .click();
  await expect(page.locator("video")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Close Evidence", exact: true })
    .click();
});
test("comments and replies persist after reload and reactions use source-post endpoints", async ({
  page,
}) => {
  const model = await fixture(page);
  await open(page);
  await write(page, "  Demo new saved discussion  ");
  await expect(
    page.getByText("Demo new saved discussion", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reply to Demo Neighbour", exact: true })
    .click();
  await write(page, "Demo saved reply", true);
  await expect(
    page.getByText("Replying to Demo Neighbour", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Like post", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unlike post", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Like comment by Demo Neighbour",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Unlike comment by Demo Neighbour",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Demo saved reply", { exact: true }),
  ).toBeVisible();
  expect(model.requests[0].body).toEqual({
    action: "comment",
    body: "Demo new saved discussion",
    parentId: null,
  });
  expect(model.requests[1].body).toEqual({
    action: "comment",
    body: "Demo saved reply",
    parentId: uid(5),
  });
  await page.getByRole("button", { name: "Unlike post", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Like post", exact: true }),
  ).toBeVisible();
});
test("official resolution opens the linked observation, displays budget/evidence and isolates update reactions/discussion", async ({
  page,
}) => {
  const model = await fixture(page);
  await open(page);
  await page
    .getByRole("button", { name: "View official resolution", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/post/${siblingId}\\?repost=${quoteId}`),
  );
  await expect(
    page.getByText("Status when published: In progress", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Resolved", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Total: ₱1,250.50", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Open document: Demo work record.pdf",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Demo update-only comment", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Demo saved comment", { exact: true })
      .filter({ visible: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Like post", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unlike post", exact: true }),
  ).toBeVisible();
  await write(page, "Demo quote discussion");
  await expect(
    page.getByText("Demo quote discussion", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Like comment by Demo Neighbour",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Unlike comment by Demo Neighbour",
      exact: true,
    }),
  ).toBeVisible();
  expect(model.post.confirmations).toBe(0);
  expect(model.post.comments).toHaveLength(1);
  expect(model.quote.post.reportSeverity).toBe(2);
  expect(model.requests.every((r) => r.path.includes("/reposts/"))).toBe(true);
});
test("failed comments retain input and reply target, reject blanks and support retry", async ({
  page,
}) => {
  let fail = true;
  await fixture(page, {
    handle: async (r, p) => {
      if (
        fail &&
        r.request().method() === "POST" &&
        p === `/api/community/posts/${postId}`
      ) {
        await json(
          r,
          { message: "Comments are temporarily unavailable." },
          503,
        );
        return true;
      }
      return false;
    },
  });
  await open(page);
  await page
    .getByRole("button", { name: "Reply to Demo Neighbour", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Send reply", exact: true }),
  ).toBeDisabled();
  await write(page, "Demo retry reply", true);
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await expect(
    page.getByRole("textbox", { name: "Your reply", exact: true }),
  ).toHaveValue("Demo retry reply");
  fail = false;
  await page
    .getByRole("button", { name: "Check discussion", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reply to Demo Neighbour", exact: true })
    .click();
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect(
    page.getByText("Demo retry reply", { exact: true }),
  ).toBeVisible();
});
test("an interrupted comment requires a discussion check before resending and does not claim success", async ({
  page,
}) => {
  let fail = true;
  const model = await fixture(page, {
    handle: async (r, p) => {
      if (
        fail &&
        r.request().method() === "POST" &&
        p === `/api/community/posts/${postId}`
      ) {
        await json(r, { success: true });
        return true;
      }
      return false;
    },
  });
  await open(page);
  await write(page, "Demo uncertain comment");
  await expect(page.getByRole("alert")).toContainText("not confirmed");
  await expect(
    page.getByRole("button", { name: "Send comment", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Check discussion", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Your comment", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Send comment", exact: true }),
  ).toBeEnabled();
  expect(model.post.comments).toHaveLength(1);
  fail = false;
  await page.getByRole("button", { name: "Send comment", exact: true }).click();
  await expect(
    page.getByText("Demo uncertain comment", { exact: true }),
  ).toBeVisible();
});
test("a saved comment remains confirmed when the follow-up read fails and retry recovers it", async ({
  page,
}) => {
  let failRead = false;
  await fixture(page, {
    handle: async (r, p, model) => {
      if (
        failRead &&
        r.request().method() === "GET" &&
        p === `/api/community/posts/${postId}` &&
        model.post.comments.length > 1
      ) {
        await json(r, { message: "Refresh unavailable." }, 503);
        return true;
      }
      return false;
    },
  });
  await open(page);
  failRead = true;
  await write(page, "Demo saved before read outage");
  await expect(page.getByRole("status")).toHaveText("Comment posted.");
  await expect(page.getByRole("alert")).toContainText("Refresh unavailable");
  failRead = false;
  await page
    .getByRole("button", { name: "Retry loading post", exact: true })
    .click();
  await expect(
    page.getByText("Demo saved before read outage", { exact: true }),
  ).toBeVisible();
});
test("pending writes block duplicate submissions and conflicting reactions", async ({
  page,
}) => {
  let release: (() => void) | undefined,
    started = false;
  await fixture(page, {
    handle: async (r, p) => {
      if (
        r.request().method() === "POST" &&
        p === `/api/community/posts/${postId}`
      ) {
        started = true;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return false;
    },
  });
  await open(page);
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your comment", exact: true })
    .fill("Demo one pending comment");
  await page.getByRole("button", { name: "Send comment", exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await expect(
    page.getByRole("button", { name: "Send comment", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Close Write comment", exact: true }),
  ).toBeDisabled();
  release?.();
  await expect(
    page.getByText("Demo one pending comment", { exact: true }),
  ).toBeVisible();
});
test("repost sends a social multipart draft with an image and retains the request UUID after interruption", async ({
  page,
}) => {
  const drafts: string[] = [];
  let fail = true;
  await fixture(page, {
    handle: async (r, p) => {
      if (p === "/api/community/reposts" && r.request().method() === "POST") {
        const raw = r.request().postData() || "";
        drafts.push(/name="id"\r\n\r\n([^\r]+)/.exec(raw)?.[1] || "");
        if (fail) {
          await json(r, { success: true });
          return true;
        }
      }
      return false;
    },
  });
  await open(page);
  await page.getByRole("button", { name: "Repost", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Add a message (optional)", exact: true })
    .fill("Demo social repost");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Add image (optional)", exact: true })
    .click();
  await (await chooser).setFiles("assets/images/icon.png");
  await expect(
    page.getByRole("img", { name: "Repost image preview", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Publish repost", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("not confirmed");
  await expect(
    page.getByRole("textbox", {
      name: "Add a message (optional)",
      exact: true,
    }),
  ).toHaveValue("Demo social repost");
  fail = false;
  await page.getByRole("button", { name: "Retry repost", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Repost published.");
  expect(drafts).toHaveLength(2);
  expect(drafts[0]).toBe(drafts[1]);
  expect(drafts[0]).toMatch(/^[a-f0-9-]{36}$/);
});
test("reposting an official update uses its source and quote ID without publishing a status", async ({
  page,
}) => {
  const model = await fixture(page);
  await authenticate(page);
  await page.goto(`/post/${siblingId}?repost=${quoteId}`);
  await page.getByRole("button", { name: "Repost", exact: true }).click();
  await page
    .getByRole("button", { name: "Publish repost", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Repost published.");
  const raw = String(model.requests[0].body);
  expect(raw).toContain(`name="postId"\r\n\r\n${siblingId}`);
  expect(raw).toContain(`name="quotedRepostId"\r\n\r\n${quoteId}`);
  expect(raw).not.toContain('name="status"');
});
test("sharing exposes the correct public quote link and recovers when device sharing is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Clipboard unavailable");
        },
      },
    });
  });
  await fixture(page);
  await authenticate(page);
  await page.goto(`/post/${siblingId}?repost=${quoteId}`);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Post link", exact: true }),
  ).toHaveValue(
    `${origin}/community/post/${siblingId}?repost=${quoteId}#repost-${quoteId}`,
  );
  await page
    .getByRole("button", { name: "Share to apps", exact: true })
    .click();
  await expect(
    page.getByText("Select and copy the link below to share this post.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(
    page.getByText("Select and copy the link below.", { exact: true }),
  ).toBeVisible();
});
test("malformed loads, unavailable reposts and invalid routes have honest retry states", async ({
  page,
}) => {
  let fail = true;
  await fixture(page, {
    handle: async (r, p) => {
      if (
        fail &&
        p === `/api/community/posts/${postId}` &&
        r.request().method() === "GET"
      ) {
        await json(r, { post: { id: postId } });
        return true;
      }
      return false;
    },
  });
  await authenticate(page);
  await page.goto(`/post/${postId}`);
  await expect(page.getByRole("alert")).toContainText("could not be read");
  fail = false;
  await page
    .getByRole("button", { name: "Retry loading post", exact: true })
    .click();
  await expect(
    page.getByText("Demo saved comment", { exact: true }),
  ).toBeVisible();
  await page.goto(`/post/${postId}?repost=${uid(99)}`);
  await expect(page.getByRole("alert")).toContainText("no longer available");
  await expect(
    page.getByRole("button", { name: "Add comment", exact: true }),
  ).toHaveCount(0);
  await page.goto("/post/invalid");
  await expect(page.getByRole("alert")).toContainText("link is invalid");
});
test("expired sessions are cleared when discussion requests return 401", async ({
  page,
}) => {
  let expired = false;
  await fixture(page, {
    handle: async (r, p) => {
      if (
        expired &&
        r.request().method() === "POST" &&
        p === `/api/community/posts/${postId}`
      ) {
        await json(r, { message: "Sign in again." }, 401);
        return true;
      }
      return false;
    },
  });
  await open(page);
  expired = true;
  await page.getByRole("button", { name: "Like post", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Your session has ended");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});
test("pending government accounts cannot load or write discussions", async ({
  page,
}) => {
  const model = await fixture(page, { pending: true });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email address" }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("DemoPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("Awaiting approval", { exact: true }),
  ).toBeVisible();
  await page.goto(`/post/${postId}`);
  await expect(
    page.getByText("Awaiting approval", { exact: true }),
  ).toBeVisible();
  expect(model.reads).toBe(0);
  expect(model.requests).toHaveLength(0);
});
test("failed or malformed post reactions do not change displayed support", async ({
  page,
}) => {
  let fail = true;
  const model = await fixture(page, {
    handle: async (r, p) => {
      if (
        fail &&
        p === `/api/community/posts/${postId}` &&
        r.request().method() === "POST"
      ) {
        await json(r, { likes: 8, userLiked: true });
        return true;
      }
      return false;
    },
  });
  await open(page);
  await page.getByRole("button", { name: "Like post", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("not confirmed");
  await expect(
    page.getByRole("button", { name: "Like post", exact: true }),
  ).toBeVisible();
  expect(model.post.confirmations).toBe(0);
  fail = false;
  await page.getByRole("button", { name: "Like post", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unlike post", exact: true }),
  ).toBeVisible();
});
test("repost picker rejects unsupported and oversized images and supports removing a valid preview", async ({
  page,
}) => {
  await fixture(page);
  await open(page);
  await page.getByRole("button", { name: "Repost", exact: true }).click();
  for (const file of [
    { name: "demo.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") },
    {
      name: "large.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    },
  ]) {
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Add image (optional)", exact: true })
      .click();
    await (await chooser).setFiles(file);
    await expect(page.getByRole("alert")).toContainText(
      file.name.endsWith("gif") ? "JPEG, PNG, or WebP" : "5 MB or less",
    );
  }
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Add image (optional)", exact: true })
    .click();
  await (await chooser).setFiles("assets/images/icon.png");
  await expect(
    page.getByRole("img", { name: "Repost image preview", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove repost image", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Repost image preview", exact: true }),
  ).toHaveCount(0);
});
test("browser sharing passes the exact link to the device and treats cancellation quietly", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        (window as Window & { shared?: ShareData }).shared = data;
        throw new DOMException("Cancelled", "AbortError");
      },
    });
  });
  await fixture(page);
  await open(page);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page
    .getByRole("button", { name: "Share to apps", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => (window as Window & { shared?: ShareData }).shared,
    ),
  ).toEqual({
    title: "Demo drainage cover report",
    url: `${origin}/community/post/${postId}`,
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByText("Sharing could not open. Select and copy the link below.", {
      exact: true,
    }),
  ).toHaveCount(0);
});
test("320px, phone, landscape and enlarged text keep discussions usable and light-only", async ({
  page,
}) => {
  await fixture(page);
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await open(page);
  for (const size of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await expect(
      page.getByRole("button", { name: "Share", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/discussion-mobile.png",
    fullPage: true,
  });
  await page.addStyleTag({
    content:
      "[dir] { overflow-wrap: anywhere; } span { font-size: 125% !important; }",
  });
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your comment", exact: true })
    .fill("Demo accessible comment");
  await page.getByRole("button", { name: "Send comment", exact: true }).click();
  await expect(
    page.getByText("Demo accessible comment", { exact: true }),
  ).toBeVisible();
});
