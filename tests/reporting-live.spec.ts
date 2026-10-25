import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  nearestRoadPoint,
  pointAlong,
  roadLength,
  selectRoadSegment,
} from "../src/lib/roads";
import { parseRoads } from "../src/lib/report-contracts";

// Opt-in only, against an isolated backend database and loopback fake Gemini.
// Never point this suite at Azure or a database containing real user reports.
test.skip(
  process.env.SURIOS_TEST_REPORTING_LIVE !== "1",
  "Requires an isolated SuriOS test backend.",
);
const origin = process.env.SURIOS_TEST_API_ORIGIN || "https://127.0.0.1:5188";
const email = `mobile-reporting-${Date.now()}@example.test`;
const password = "LocalReportingFixture123!";
const caption =
  "Demo evidence: visible deterioration near a public access area.";
let authorization = "";
const createdPosts: string[] = [];

test.beforeAll(async ({ playwright }) => {
  if (process.env.SURIOS_TEST_REPORTING_LIVE !== "1") return;
  const url = new URL(origin);
  if (!["127.0.0.1", "localhost"].includes(url.hostname))
    throw new Error(
      "Live reporting tests require a loopback backend and disposable data.",
    );
  const api = await playwright.request.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
  });
  const response = await api.post("/api/auth/register", {
    data: {
      name: "Demo Mobile Reporter",
      email,
      password,
      confirmPassword: password,
    },
  });
  expect(response.status()).toBe(201);
  const issued = await response.json();
  authorization = `Bearer ${issued.accessToken}`;
  await api.dispose();
});
test.afterAll(async ({ playwright }) => {
  if (!authorization) return;
  const api = await playwright.request.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
  });
  for (const id of createdPosts)
    await api.delete(`/api/community/posts/${id}`, {
      headers: { Authorization: authorization },
    });
  await api.post("/api/auth/logout", {
    headers: { Authorization: authorization },
  });
  await api.dispose();
});
test("actual mobile UI uploads, assesses, saves a post, and opens the same stored hazard and source", async ({
  page,
  playwright,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Community feed", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create a report", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Headline", exact: true })
    .fill("Demo · Mobile map reporting verification");
  await page
    .getByRole("textbox", { name: "What happened?", exact: true })
    .fill(caption);
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Upload report evidence", exact: true })
    .click();
  await (await chooser).setFiles("assets/images/icon.png");
  const assessmentResponse = page.waitForResponse(
    (r) =>
      r.url() === `${origin}/api/community/assess` &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Assess evidence", exact: true })
    .click();
  const assessed = await assessmentResponse;
  expect(assessed.status()).toBe(200);
  await expect(page.getByText("Severity 3/10", { exact: true })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Location or landmark", exact: true })
    .fill("Demo access area, Santa Cruz");
  await page
    .getByRole("textbox", { name: "Latitude", exact: true })
    .fill("14.2813");
  await page
    .getByRole("textbox", { name: "Longitude", exact: true })
    .fill("121.4173");
  await page
    .getByRole("button", { name: "Place pin at coordinates", exact: true })
    .click();
  const publishResponse = page.waitForResponse(
    (r) =>
      r.url() === `${origin}/api/community/posts` &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Publish report", exact: true })
    .click();
  const published = await publishResponse;
  expect(published.status()).toBe(201);
  const saved = await published.json();
  createdPosts.push(saved.id);
  await expect(
    page.getByText(
      saved.grouped
        ? "Post published and linked to the existing hazard. Its current status and severity come from that shared issue."
        : "Your report was published.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Demo · Mobile map reporting verification", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View published hazard on map", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Demo · Mobile map reporting verification",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Open source post: Demo · Mobile map reporting verification",
      exact: true,
    }),
  ).toBeVisible();
  const api = await playwright.request.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Authorization: authorization },
  });
  const detail = await api.get(`/api/community/posts/${saved.id}`);
  expect(detail.status()).toBe(200);
  const thread = await detail.json();
  expect(thread.post.reportId).toBe(saved.reportId);
  expect(thread.post.body).toBe(caption);
  expect(thread.post.analysis.hazardSeverity).toBe(3);
  const map = await api.get(`/api/map/reports/${saved.reportId}`);
  expect(map.status()).toBe(200);
  const mapData = await map.json();
  expect(mapData.hazard.posts.map((p: { id: string }) => p.id)).toContain(
    saved.id,
  );
  const photo = await api.get(thread.post.media[0].url);
  expect(photo.status()).toBe(200);
  expect(photo.headers()["content-type"]).toContain("image/png");
  await page.screenshot({
    path: "artifacts/map-real-backend-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", {
      name: "Close Demo · Mobile map reporting verification",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await api.dispose();
});

test("native-style multipart and mobile geometry publish a server-verified real OpenStreetMap section", async ({
  playwright,
}) => {
  const api = await playwright.request.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Authorization: authorization },
  });
  const roadsResponse = await api.get("/api/roads?lat=14.2813&lng=121.4173");
  expect(roadsResponse.status()).toBe(200);
  const roads = parseRoads(await roadsResponse.json());
  const nearest = roads
    .filter((r) => roadLength(r.coordinates) >= 5)
    .map((way) => ({
      way,
      snap: nearestRoadPoint(way.coordinates, [14.2813, 121.4173]),
    }))
    .sort((a, b) => a.snap.distance - b.snap.distance)[0];
  // The city center itself is off-street; select the actual returned road point.
  const target = pointAlong(nearest.way.coordinates, nearest.snap.offset);
  expect(
    nearestRoadPoint(nearest.way.coordinates, target).distance,
  ).toBeLessThan(0.01);
  const total = roadLength(nearest.way.coordinates),
    start = Math.max(0, Math.min(total - 5, nearest.snap.offset - 40));
  const section = selectRoadSegment(
    nearest.way,
    start,
    Math.min(total, start + 80),
  );
  const draftId = randomUUID(),
    title = "Demo · Native road section verification";
  const assessment = await api.post("/api/community/assess", {
    headers: { "X-Assessment-Id": draftId },
    multipart: {
      headline: title,
      caption,
      media: {
        name: "explicit-demo-evidence.png",
        mimeType: "image/png",
        buffer: await readFile("assets/images/icon.png"),
      },
    },
  });
  expect(assessment.status()).toBe(200);
  const draft = await assessment.json(),
    point = pointAlong(section.coordinates, section.length / 2);
  const publication = await api.post("/api/community/posts", {
    data: {
      draftId,
      coverId: draft.media[0].id,
      title,
      body: caption,
      locationName: "Demo road section, Santa Cruz",
      latitude: point[0],
      longitude: point[1],
      road: { id: section.id, start: section.start, end: section.end },
    },
  });
  expect(publication.status()).toBe(201);
  const saved = await publication.json();
  createdPosts.push(saved.id);
  const post = await (await api.get(`/api/community/posts/${saved.id}`)).json();
  expect(post.post.roadSegment.id).toBe(section.id);
  expect(post.post.roadSegment.length).toBeCloseTo(section.length, 1);
  // A road selection locates the issue without reclassifying the server's broader asset assessment.
  expect(post.post.analysis.infrastructureType).toBe(
    "OTHER_PUBLIC_INFRASTRUCTURE",
  );
  const replay = await api.post("/api/community/posts", {
    data: {
      draftId,
      coverId: draft.media[0].id,
      title,
      body: caption,
      locationName: "Demo road section, Santa Cruz",
      latitude: point[0],
      longitude: point[1],
      road: { id: section.id, start: section.start, end: section.end },
    },
  });
  expect(replay.status()).toBe(201);
  expect((await replay.json()).id).toBe(saved.id);
  await api.dispose();
});
