import { test, expect, type Page, type Route } from "@playwright/test";
const origin = process.env.SURIOS_TEST_API_ORIGIN || "http://127.0.0.1:5185";
const user = {
  id: "demo-citizen",
  name: "Alex Cruz",
  email: "alex@example.test",
  role: "CITIZEN",
  accountStatus: "ACTIVE",
  avatarUrl: null,
};
const analysis = {
  isValidInfrastructure: true,
  infrastructureType: "DRAINAGE_FLOOD_CANAL",
  distressType: "drainage_blockage",
  hazardSeverity: 3,
  riskLevel: "LOW",
  summary: "Localized debris blocks the visible drain opening.",
  recommendedAction: "Arrange a site inspection and clear the opening.",
  severityEvidence: {
    visibleDefects: ["Debris in the drain opening."],
    reportedConditions: ["Reporter mentions pooling after rain."],
    criticalDangerVisible: false,
    confidence: "MEDIUM",
    limitations: "Drain depth and underground condition cannot be verified.",
  },
};
const road = {
  id: "12345",
  name: "Demo mapped road",
  coordinates: [
    [14.279, 121.4173],
    [14.285, 121.4173],
  ],
};
function hazard(id = "drain", extra: object = {}) {
  return {
    id,
    title: `Demo ${id} report`,
    location: "Santa Cruz demo location",
    latitude: 14.2813,
    longitude: 121.4173,
    distressType: "drainage_blockage",
    severity: 3,
    vruLethality: "LOW",
    status: "REPORTED",
    support: 3,
    observations: 2,
    priority: 3.5,
    createdAt: "2026-10-25T00:00:00Z",
    updatedAt: "2026-10-25T00:00:00Z",
    imageUrl: "/media/demo.png",
    mediaKind: "photo",
    analysis,
    media: [
      {
        id: "media-1",
        kind: "photo",
        url: "/media/demo.png",
        name: "demo.png",
        mimeType: "image/png",
      },
    ],
    posts: [
      {
        id: "source-one",
        title: "Demo original evidence",
        author: "Demo Citizen",
        createdAt: "2026-10-25T00:00:00Z",
        match: { reason: "Evidence identifies the same drain." },
      },
      {
        id: "source-two",
        title: "Demo follow-up evidence",
        author: "Second Demo Citizen",
        createdAt: "2026-10-25T01:00:00Z",
        match: { reason: "Same physical issue, independently reported." },
      },
    ],
    ...extra,
  };
}
const post = (id = "saved-post") => ({
  id,
  title: "Demo published drain",
  body: "Debris is visible near the opening.",
  createdAt: "2026-10-25T00:00:00Z",
  author: { name: user.name },
  media: [
    {
      id: "saved-media",
      url: "/media/demo.png",
      kind: "photo",
      name: "demo.png",
      mimeType: "image/png",
    },
  ],
  reportId: "drain",
  reportStatus: "REPORTED",
  locationName: "Demo canal, Santa Cruz",
});
async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "Access-Control-Allow-Origin": "http://localhost:8082",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Assessment-Id",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE",
    },
    body: status === 204 ? undefined : JSON.stringify(body),
  });
}
async function setup(
  page: Page,
  handler?: (route: Route, path: string) => Promise<boolean>,
) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page
    .context()
    .route(`${origin}/community/**`, (r) =>
      r.fulfill({
        contentType: "text/html",
        body: "<title>Demo source post</title><p>Saved source evidence fixture</p>",
      }),
    );
  await page.route("https://tile.openstreetmap.org/**", (r) =>
    r.fulfill({ path: "assets/images/icon.png", contentType: "image/png" }),
  );
  await page.route(`${origin}/media/**`, (r) =>
    r.fulfill({ path: "assets/images/icon.png", contentType: "image/png" }),
  );
  await page.route(`${origin}/api/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "OPTIONS") return json(route, null);
    if (await handler?.(route, path)) return;
    if (path === "/api/auth/login")
      return json(route, {
        accessToken: `surios_mobile_${"a".repeat(64)}`,
        tokenType: "Bearer",
        user,
        expiresAt: "2099-01-01T00:00:00Z",
      });
    if (path === "/api/auth/session")
      return json(route, { user, expiresAt: "2099-01-01T00:00:00Z" });
    if (path === "/api/community/posts")
      return json(
        route,
        route.request().method() === "POST"
          ? { id: "saved-post", reportId: "drain", grouped: true }
          : {
              feed: [{ kind: "post", post: post() }],
              currentPage: 1,
              hasMore: false,
            },
      );
    if (path === "/api/map/reports")
      return json(route, {
        hazards: [
          hazard(),
          hazard("separate-pothole", {
            severity: 9,
            priority: 9,
            distressType: "pothole",
            status: "RESOLVED",
            analysis: {
              ...analysis,
              infrastructureType: "ROAD_PAVEMENT",
              distressType: "pothole",
              hazardSeverity: 9,
            },
          }),
        ],
        asOf: "2026-10-25T00:00:00Z",
      });
    if (path.startsWith("/api/map/reports/"))
      return json(route, {
        hazard: hazard(path.split("/").pop()),
        asOf: "2026-10-25T00:00:00Z",
      });
    if (path === "/api/roads") return json(route, { roads: [road] });
    if (path.startsWith("/api/community/drafts/"))
      return json(route, null, 204);
    if (path === "/api/community/assess") {
      const id = route.request().headers()["x-assessment-id"];
      return json(route, {
        draftId: id,
        media: [
          {
            id: "server-media-1",
            url: "/media/demo.png",
            kind: "photo",
            name: "demo.png",
            mimeType: "image/png",
          },
        ],
        analysis,
        context: {
          headline: "Demo drainage blockage",
          caption: "Visible debris beside the drain.",
        },
      });
    }
    if (path === "/api/route")
      return json(route, {
        route: {
          coordinates: [
            [14.279, 121.416],
            [14.2813, 121.4173],
          ],
          distanceFormatted: "0.4 km",
          durationFormatted: "2 min",
          originName: "Municipal depot",
          estimated: true,
        },
      });
    return json(route, { message: "Not found" }, 404);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email address" }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("DemoPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Community feed", exact: true }),
  ).toBeVisible();
  return errors;
}
async function composer(page: Page) {
  await page
    .getByRole("button", { name: "Create a report", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Start a post", exact: true }),
  ).toBeVisible();
}
async function evidence(page: Page, title = "Demo drainage blockage") {
  await page
    .getByRole("textbox", { name: "Headline", exact: true })
    .fill(title);
  await page
    .getByRole("textbox", { name: "What happened?", exact: true })
    .fill("Visible debris beside the drain.");
  const picker = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Upload report evidence", exact: true })
    .click();
  await (await picker).setFiles("assets/images/icon.png");
  await expect(page.getByLabel("Selected post cover")).toBeVisible();
}
async function assess(page: Page) {
  await page
    .getByRole("button", { name: "Assess evidence", exact: true })
    .click();
  await expect(page.getByText("Severity 3/10", { exact: true })).toBeVisible();
}
async function pointLocation(page: Page) {
  await page
    .getByRole("textbox", { name: "Location or landmark", exact: true })
    .fill("Demo canal, Santa Cruz");
  await page
    .getByRole("button", { name: "Drop pin at map center", exact: true })
    .click();
}

test("live map renderer clusters separate issues, opens source posts and exposes severity distinctly", async ({
  page,
}) => {
  const errors = await setup(page);
  await page.getByRole("button", { name: "Map", exact: true }).click();
  const frame = page.frameLocator('iframe[title="Hazard map"]');
  await expect(frame.locator(".hazard-pin small")).toHaveText("2");
  await frame.locator(".hazard-pin").click();
  await expect(
    page.getByRole("heading", { name: "At this pin", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("2 separate hazards", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Open hazard: Demo drain report",
      exact: true,
    })
    .click();
  await expect(page.getByText("3/10", { exact: true })).toBeVisible();
  await expect(page.getByText("3.5", { exact: true })).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  await page
    .getByRole("button", {
      name: "Open source post: Demo original evidence",
      exact: true,
    })
    .click();
  const popup = await popupPromise;
  expect(popup.url()).toBe(`${origin}/community/post/source-one`);
  await popup.close();
  await page.screenshot({
    path: "artifacts/map-hazard-details-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("filters and layers apply canonical statuses and keep report list usable", async ({
  page,
}) => {
  const errors = await setup(page);
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("button", { name: "Resolved", exact: true }).click();
  await page
    .getByRole("button", { name: "Show 1 matching reports", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Open hazard: Demo separate-pothole report",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Open hazard: Demo drain report",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Close Reports", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page
    .getByRole("switch", { name: "Reference roads", exact: true })
    .click();
  await expect(
    page.getByText(
      "Dashed lines show named road corridors for context. They do not indicate measured condition.",
    ),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("map camera opens the connected composer; real multipart assessment then publishes and refreshes feed", async ({
  page,
}) => {
  let assessmentBody = "",
    posted: unknown;
  const errors = await setup(page, async (route, path) => {
    if (path === "/api/community/assess")
      assessmentBody = route.request().postData() || "";
    if (path === "/api/community/posts" && route.request().method() === "POST")
      posted = route.request().postDataJSON();
    return false;
  });
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await page
    .getByRole("button", { name: "Create a post from the map", exact: true })
    .click();
  await evidence(page);
  await assess(page);
  expect(assessmentBody).toContain('name="media"');
  expect(assessmentBody).toContain("Visible debris beside the drain.");
  await pointLocation(page);
  await page
    .getByRole("button", { name: "Publish report", exact: true })
    .click();
  await expect(
    page.getByText(
      "Post published and linked to the existing hazard. Its current status and severity come from that shared issue.",
    ),
  ).toBeVisible();
  expect(posted).toMatchObject({
    coverId: "server-media-1",
    title: "Demo drainage blockage",
    locationName: "Demo canal, Santa Cruz",
    road: null,
  });
  expect(posted).not.toHaveProperty("analysis");
  await page
    .getByRole("button", { name: "View published hazard on map", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Demo drain report", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("road selection is clickable, endpoint tap controls change the real section, and publication sends offsets", async ({
  page,
}) => {
  let posted: Record<string, unknown> | undefined;
  const errors = await setup(page, async (route, path) => {
    if (path === "/api/community/posts" && route.request().method() === "POST")
      posted = route.request().postDataJSON();
    return false;
  });
  await composer(page);
  await evidence(page);
  await assess(page);
  await page
    .getByRole("textbox", { name: "Location or landmark", exact: true })
    .fill("Demo road, Santa Cruz");
  await page.getByRole("button", { name: "Road section", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Road section", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Select road at map center", exact: true })
    .click();
  await expect(
    page.getByText("Demo mapped road · 80 m", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "B +5 m", exact: true }).click();
  await expect(
    page.getByText("Demo mapped road · 85 m", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/map-road-composer-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Publish report", exact: true })
    .click();
  await expect(
    page.getByText(
      "Post published and linked to the existing hazard. Its current status and severity come from that shared issue.",
    ),
  ).toBeVisible();
  expect(posted?.road).toMatchObject({ id: "12345" });
  const section = posted?.road as { start: number; end: number };
  expect(section.end - section.start).toBeCloseTo(85);
  expect(errors).toEqual([]);
});
test("pin landing shadow is visible before dropping and a point can be selected by tapping the map", async ({
  page,
}) => {
  await setup(page);
  await composer(page);
  const frame = page.frameLocator('iframe[title="Report location map"]');
  await expect(frame.locator(".drop-shadow")).toBeVisible();
  await expect(frame.locator(".location-pin")).toBeVisible();
  await frame.locator("#map").click({ position: { x: 120, y: 160 } });
  await expect(page.getByText(/^Pin: /)).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Latitude", exact: true }),
  ).not.toHaveValue("");
});
test("editing assessed caption disables publication and discards the stale server draft", async ({
  page,
}) => {
  let discarded = 0;
  await setup(page, async (route, path) => {
    if (
      path.startsWith("/api/community/drafts/") &&
      route.request().method() === "DELETE"
    )
      discarded++;
    return false;
  });
  await composer(page);
  await evidence(page);
  await assess(page);
  await pointLocation(page);
  await expect(
    page.getByRole("button", { name: "Publish report", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("textbox", { name: "What happened?", exact: true })
    .fill("Different current context.");
  await expect(
    page.getByRole("button", { name: "Publish report", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("Severity 3/10", { exact: true })).toHaveCount(0);
  await expect.poll(() => discarded).toBe(1);
  await expect(
    page.getByText(
      "Text changed. Assess again to include your current headline and caption.",
    ),
  ).toBeVisible();
});
test("AI unavailability, rejected evidence and expired draft retain the editable report", async ({
  page,
}) => {
  let attempts = 0;
  await setup(page, async (route, path) => {
    if (path === "/api/community/assess") {
      attempts++;
      if (attempts === 1) {
        await json(
          route,
          { message: "AI assessment is temporarily unavailable." },
          503,
        );
        return true;
      }
      if (attempts === 2) {
        await json(
          route,
          {
            error: "This evidence is unrelated.",
            analysis: { ...analysis, isValidInfrastructure: false },
          },
          422,
        );
        return true;
      }
    }
    if (
      path === "/api/community/posts" &&
      route.request().method() === "POST"
    ) {
      await json(route, { message: "This assessment expired." }, 410);
      return true;
    }
    return false;
  });
  await composer(page);
  await evidence(page);
  await page
    .getByRole("button", { name: "Assess evidence", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText(
    "AI assessment is temporarily unavailable.",
  );
  await expect(page.getByLabel("Selected post cover")).toBeVisible();
  await page
    .getByRole("button", { name: "Assess evidence", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText(
    "This evidence is unrelated.",
  );
  await assess(page);
  await pointLocation(page);
  await page
    .getByRole("button", { name: "Publish report", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText("This assessment expired.");
  await expect(
    page.getByRole("textbox", { name: "Headline", exact: true }),
  ).toHaveValue("Demo drainage blockage");
  await expect(
    page.getByRole("button", { name: "Publish report", exact: true }),
  ).toBeDisabled();
});
test("discard confirmation preserves work until chosen and removes the owned draft when discarded", async ({
  page,
}) => {
  let discarded = 0;
  await setup(page, async (route, path) => {
    if (path.startsWith("/api/community/drafts/")) discarded++;
    return false;
  });
  await composer(page);
  await evidence(page);
  await assess(page);
  await page
    .getByRole("button", { name: "Close Start a post", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Discard this post?", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Headline", exact: true }),
  ).toHaveValue("Demo drainage blockage");
  await page
    .getByRole("button", { name: "Close Start a post", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Discard post", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Start a post", exact: true }),
  ).toHaveCount(0);
  await expect.poll(() => discarded).toBe(1);
});
test("map failure has a retry and coordinate fallback remains available when GPS is denied", async ({
  page,
  context,
}) => {
  await context.clearPermissions();
  let failed = true;
  await setup(page, async (route, path) => {
    if (path === "/api/map/reports" && failed) {
      await json(
        route,
        { message: "Map reports temporarily unavailable." },
        503,
      );
      return true;
    }
    return false;
  });
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Map reports temporarily unavailable.",
  );
  failed = false;
  await page
    .getByRole("button", { name: "Retry map reports", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Create a post from the map", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use my location", exact: true })
    .click();
  await expect(
    page.getByText(
      "Location access is unavailable. Allow it in Settings, tap the map, or enter coordinates.",
    ),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Latitude", exact: true })
    .fill("14.282");
  await page
    .getByRole("textbox", { name: "Longitude", exact: true })
    .fill("121.418");
  await page
    .getByRole("button", { name: "Place pin at coordinates", exact: true })
    .click();
  await expect(
    page.getByText("Pin: 14.282000, 121.418000", { exact: true }),
  ).toBeVisible();
});
test("small screen with enlarged text keeps controls reachable without horizontal overflow", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addStyleTag({ content: "html {font-size:22px}" });
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await page
    .getByRole("button", { name: "Create a post from the map", exact: true })
    .click();
  await evidence(page);
  await assess(page);
  await pointLocation(page);
  await page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>(
      "div, span, input, textarea",
    )) {
      if (element.children.length) continue;
      const style = getComputedStyle(element),
        font = parseFloat(style.fontSize),
        line = parseFloat(style.lineHeight);
      element.style.fontSize = `${font * 1.5}px`;
      if (Number.isFinite(line)) element.style.lineHeight = `${line * 1.5}px`;
    }
  });
  await expect(
    page.getByRole("button", { name: "Publish report", exact: true }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await page.screenshot({
    path: "artifacts/map-composer-small.png",
    fullPage: true,
  });
});

test("multiple attachments retain their order and the chosen cover uses the corresponding saved media ID", async ({
  page,
}) => {
  let posted: Record<string, unknown> | undefined;
  await setup(page, async (route, path) => {
    if (path === "/api/community/assess") {
      await json(route, {
        draftId: route.request().headers()["x-assessment-id"],
        media: [
          {
            id: "server-first",
            url: "/media/one.png",
            kind: "photo",
            name: "one.png",
            mimeType: "image/png",
          },
          {
            id: "server-second",
            url: "/media/two.png",
            kind: "photo",
            name: "two.png",
            mimeType: "image/png",
          },
        ],
        analysis,
        context: {
          headline: "Demo drainage blockage",
          caption: "Visible debris beside the drain.",
        },
      });
      return true;
    }
    if (path === "/api/community/posts" && route.request().method() === "POST")
      posted = route.request().postDataJSON();
    return false;
  });
  await composer(page);
  await page
    .getByRole("textbox", { name: "Headline", exact: true })
    .fill("Demo drainage blockage");
  await page
    .getByRole("textbox", { name: "What happened?", exact: true })
    .fill("Visible debris beside the drain.");
  const picker = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Upload report evidence", exact: true })
    .click();
  await (
    await picker
  ).setFiles(["assets/images/icon.png", "assets/images/favicon.png"]);
  await page
    .getByRole("button", { name: "Use attachment 2 as cover", exact: true })
    .click();
  await assess(page);
  await pointLocation(page);
  await page
    .getByRole("button", { name: "Publish report", exact: true })
    .click();
  await expect(
    page.getByText(
      "Post published and linked to the existing hazard. Its current status and severity come from that shared issue.",
    ),
  ).toBeVisible();
  expect(posted?.coverId).toBe("server-second");
});
test("cancelling an in-flight assessment discards it and a late response never enables publishing", async ({
  page,
}) => {
  let release!: () => void,
    discarded = 0;
  const wait = new Promise<void>((r) => {
    release = r;
  });
  await setup(page, async (route, path) => {
    if (path === "/api/community/assess") {
      await wait;
      await json(route, {
        draftId: route.request().headers()["x-assessment-id"],
        media: [
          {
            id: "late",
            url: "/media/demo.png",
            kind: "photo",
            name: "demo.png",
            mimeType: "image/png",
          },
        ],
        analysis,
        context: {
          headline: "Demo drainage blockage",
          caption: "Visible debris beside the drain.",
        },
      }).catch(() => {});
      return true;
    }
    if (path.startsWith("/api/community/drafts/")) discarded++;
    return false;
  });
  await composer(page);
  await evidence(page);
  await page
    .getByRole("button", { name: "Assess evidence", exact: true })
    .click();
  await expect(
    page.getByText("Uploading and assessing evidence…"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel assessment", exact: true })
    .click();
  release();
  await expect(
    page.getByText(
      "Assessment cancelled. Your text and attachments are still here.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish report", exact: true }),
  ).toBeDisabled();
  await expect.poll(() => discarded).toBe(1);
});
test("road pin can be dragged with a landing shadow and resolves a mapped road only after dropping", async ({
  page,
}) => {
  let lookups = 0;
  await setup(page, async (_route, path) => {
    if (path === "/api/roads") lookups++;
    return false;
  });
  await composer(page);
  await page.getByRole("button", { name: "Road section", exact: true }).click();
  const frame = page.frameLocator('iframe[title="Report location map"]');
  await frame.locator(".location-pin").scrollIntoViewIfNeeded();
  const marker = frame.locator(".location-pin");
  const box = await marker.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 + 4, {
    steps: 6,
  });
  await expect(frame.locator(".drop-shadow")).toBeVisible();
  expect(lookups).toBe(0);
  await page.mouse.up();
  await expect(
    page.getByText("Demo mapped road · 80 m", { exact: true }),
  ).toBeVisible();
  expect(lookups).toBe(1);
});
test("server validation and repeat-publish guards preserve the draft for retry", async ({
  page,
}) => {
  let publishes = 0,
    finish!: () => void;
  const delayed = new Promise<void>((r) => {
    finish = r;
  });
  await setup(page, async (route, path) => {
    if (
      path === "/api/community/posts" &&
      route.request().method() === "POST"
    ) {
      publishes++;
      if (publishes === 1) {
        await delayed;
        await json(
          route,
          { message: "Publishing service is temporarily unavailable." },
          503,
        );
        return true;
      }
    }
    return false;
  });
  await composer(page);
  await evidence(page);
  await assess(page);
  await pointLocation(page);
  await page
    .getByRole("button", { name: "Publish report", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Publishing…", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Close Start a post", exact: true }),
  ).toBeDisabled();
  finish();
  await expect(page.getByRole("alert")).toHaveText(
    "Publishing service is temporarily unavailable.",
  );
  await expect(
    page.getByRole("button", { name: "Publish report", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Publish report", exact: true })
    .click();
  await expect(
    page.getByText(
      "Post published and linked to the existing hazard. Its current status and severity come from that shared issue.",
    ),
  ).toBeVisible();
  expect(publishes).toBe(2);
});
test("reduced motion and landscape keep map, composer and publishing controls accessible", async ({
  page,
}) => {
  await setup(page);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.setViewportSize({ width: 812, height: 375 });
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await page
    .getByRole("button", { name: "Create a post from the map", exact: true })
    .click();
  const frame = page.frameLocator('iframe[title="Report location map"]');
  await expect(frame.locator(".location-pin")).toHaveCSS(
    "animation-name",
    "none",
  );
  await page
    .locator('iframe[title="Report location map"]')
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Publish report", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish report", exact: true }),
  ).toHaveCSS("background-color", "rgb(201, 61, 0)");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("a resolved hazard opens the linked government explanation rather than another report", async ({
  page,
}) => {
  await setup(page, async (route, path) => {
    if (path === "/api/community/posts/source-one") {
      await json(route, {
        post: {
          governmentUpdateLink:
            "/community/post/source-two?repost=official-resolution#repost-official-resolution",
        },
      });
      return true;
    }
    return false;
  });
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await page.getByRole("button", { name: "Reports · 2", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Open hazard: Demo separate-pothole report",
      exact: true,
    })
    .click();
  const popup = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "View official resolution", exact: true })
    .click();
  const opened = await popup;
  await expect(opened).toHaveURL(
    `${origin}/community/post/source-two?repost=official-resolution#repost-official-resolution`,
  );
  await opened.close();
});
test("feed deep links also load a hazard outside the latest map snapshot", async ({
  page,
}) => {
  let details = 0;
  await setup(page, async (route, path) => {
    if (path === "/api/community/posts" && route.request().method() === "GET") {
      await json(route, {
        feed: [{ kind: "post", post: { ...post(), reportId: "older-hazard" } }],
        currentPage: 1,
        hasMore: false,
      });
      return true;
    }
    if (path === "/api/map/reports/older-hazard") {
      details++;
      await json(route, {
        hazard: hazard("older-hazard"),
        asOf: "2026-10-25T00:00:00Z",
      });
      return true;
    }
    return false;
  });
  await page
    .getByRole("button", { name: "View on hazard map", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Demo older-hazard report",
      exact: true,
    }),
  ).toBeVisible();
  expect(details).toBe(1);
});
