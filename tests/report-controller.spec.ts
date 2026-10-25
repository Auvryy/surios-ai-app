import { test, expect } from "@playwright/test";
import { ApiError, createApiClient } from "../src/lib/api-client";
import { ReportController } from "../src/reporting/report-controller";
import {
  mediaError,
  PHOTO_LIMIT,
  VIDEO_LIMIT,
  type Attachment,
  type Request,
} from "../src/reporting/contracts";
import {
  filterHazards,
  emptyMapFilters,
  parseMapSnapshot,
} from "../src/lib/map-data";
import {
  MIN_ROAD_METERS,
  MAX_ROAD_METERS,
  meters,
  moveRoadEnd,
  nearestRoadPoint,
  pointAlong,
  roadLength,
  selectRoadSegment,
  type RoadWay,
} from "../src/lib/roads";
const draftId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const analysis = {
  isValidInfrastructure: true,
  infrastructureType: "DRAINAGE_FLOOD_CANAL",
  distressType: "drainage_blockage",
  hazardSeverity: 3,
  riskLevel: "LOW",
  summary: "Visible localized blockage.",
  recommendedAction: "Inspect and clear.",
  severityEvidence: {
    visibleDefects: ["Debris at drain opening"],
    reportedConditions: ["Water pools after rain"],
    confidence: "MEDIUM",
    limitations: "Depth cannot be verified.",
    criticalDangerVisible: false,
  },
};
const file = (id = "photo1"): Attachment => ({
  id,
  uri: `file:///${id}.jpg`,
  name: `${id}.jpg`,
  mimeType: "image/jpeg",
  size: 1024,
});
const road: RoadWay = {
  id: "12345",
  name: "Demo mapped road",
  coordinates: [
    [14.28, 121.41],
    [14.29, 121.41],
    [14.29, 121.42],
  ],
};
function setup(
  handler?: (path: string, options: Parameters<Request>[1]) => Promise<unknown>,
) {
  const calls: { path: string; options: Parameters<Request>[1] }[] = [];
  const request: Request = async <T>(
    path: string,
    options?: Parameters<Request>[1],
  ) => {
    calls.push({ path, options });
    if (handler) return (await handler(path, options)) as T;
    if (options?.method === "DELETE") return null as T;
    if (path.endsWith("/assess"))
      return {
        draftId,
        media: [
          {
            id: "server-cover1",
            kind: "photo",
            url: "/media/saved.jpg",
            name: "saved.jpg",
            mimeType: "image/jpeg",
          },
        ],
        analysis,
        context: {
          headline: String(
            options?.form?.get("headline") || "Drainage blockage",
          ),
          caption: String(options?.form?.get("caption")),
        },
      } as T;
    return {
      id: "saved-post",
      reportId: "canonical-hazard",
      grouped: true,
    } as T;
  };
  const controller = new ReportController(
    request,
    () => draftId,
    (files, title, body) => {
      const form = new FormData();
      files.forEach((f) =>
        form.append(
          "media",
          new Blob(["evidence"], { type: f.mimeType }),
          f.name,
        ),
      );
      form.append("headline", title);
      form.append("caption", body);
      return form;
    },
  );
  controller.add([file()]);
  controller.edit("title", "Blocked community drain");
  controller.edit("body", "Water pools after rain");
  controller.setLocation({
    mode: "point",
    point: [14.28, 121.41],
    road: null,
    name: "Demo canal, Santa Cruz",
  });
  return { controller, calls };
}
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

test("multipart transport retains bearer and assessment ID without inventing a boundary or cookies", async () => {
  const form = new FormData();
  form.append(
    "media",
    new Blob(["evidence"], { type: "image/jpeg" }),
    "evidence.jpg",
  );
  const request = createApiClient(
    () => "https://surios.site",
    async (_url, options) => {
      expect(options?.headers).toEqual({
        Accept: "application/json",
        Authorization: "Bearer opaque",
        "X-Assessment-Id": draftId,
      });
      expect(options?.body).toBe(form);
      expect(options?.credentials).toBe("omit");
      return Response.json(
        { error: "Unsupported evidence", analysis },
        { status: 422 },
      );
    },
  );
  await expect(
    request("/api/community/assess", {
      method: "POST",
      form,
      token: "opaque",
      assessmentId: draftId,
    }),
  ).rejects.toMatchObject({
    status: 422,
    message: "Unsupported evidence",
    details: { analysis },
  });
  await expect(
    request("/api/community/assess", { form, body: {} }),
  ).rejects.toThrow("one request body");
});
test("file limits match the backend, including video, total size, and unsupported HEIC", () => {
  expect(mediaError([{ ...file(), size: PHOTO_LIMIT }])).toBe("");
  expect(mediaError([{ ...file(), size: PHOTO_LIMIT + 1 }])).toContain("5 MB");
  const video = { ...file(), mimeType: "video/mp4", size: VIDEO_LIMIT };
  expect(mediaError([video, video])).toBe("");
  expect(mediaError([video, video, file()])).toContain("50 MB");
  expect(mediaError(Array.from({ length: 7 }, () => file()))).toContain("6");
  expect(mediaError([{ ...file(), mimeType: "image/heic" }])).toContain("JPEG");
});
test("assessment and publication use returned cover, context and canonical hazard IDs", async () => {
  const { controller, calls } = setup();
  await controller.assess();
  expect(controller.getSnapshot().assessment?.analysis.hazardSeverity).toBe(3);
  expect(calls[0].options?.form?.get("caption")).toBe("Water pools after rain");
  expect(calls[0].options?.timeoutMs).toBeGreaterThan(20000);
  const result = await controller.publish();
  expect(result).toEqual({
    id: "saved-post",
    reportId: "canonical-hazard",
    grouped: true,
  });
  expect(calls[1].options?.body).toMatchObject({
    draftId,
    coverId: "server-cover1",
    title: "Blocked community drain",
    road: null,
  });
  controller.dispose();
  await flush();
  expect(calls.filter((c) => c.options?.method === "DELETE")).toHaveLength(0);
});
test("changing headline, caption or attachments invalidates assessment while cover and location changes do not", async () => {
  const { controller, calls } = setup();
  await controller.assess();
  controller.setCover("photo1");
  controller.setLocation({
    mode: "point",
    point: [14.3, 121.4],
    road: null,
    name: "Other landmark",
  });
  expect(controller.getSnapshot().assessment).not.toBeNull();
  controller.edit("body", "New reporter context");
  expect(controller.getSnapshot().assessment).toBeNull();
  await controller.publish();
  expect(calls.some((c) => c.path === "/api/community/posts")).toBe(false);
  await flush();
  expect(calls.some((c) => c.path.includes(`/drafts/${draftId}`))).toBe(true);
  await controller.assess();
  controller.remove("photo1");
  expect(controller.getSnapshot().assessment).toBeNull();
  expect(controller.getSnapshot().attachments).toHaveLength(0);
});
test("late cancelled assessment cannot restore stale evidence or allow publication", async () => {
  let finish!: (v: unknown) => void;
  const response = new Promise((r) => {
    finish = r;
  });
  const { controller, calls } = setup(async (path, options) =>
    options?.method === "DELETE" ? null : response,
  );
  const pending = controller.assess();
  await flush();
  controller.edit("title", "Different issue now");
  expect(calls[0].options?.signal?.aborted).toBe(true);
  finish({
    draftId,
    media: [],
    analysis,
    context: { headline: "Old", caption: "" },
  });
  await pending;
  await flush();
  expect(controller.getSnapshot().assessment).toBeNull();
  expect(controller.getSnapshot().title).toBe("Different issue now");
  expect(calls.some((c) => c.options?.method === "DELETE")).toBe(true);
});
test("AI failure and irrelevant evidence keep user input and evidence for recovery", async () => {
  const { controller } = setup(async (path, options) => {
    if (options?.method === "DELETE") return null;
    throw new ApiError("Unrelated image", 422, {
      analysis: {
        ...analysis,
        isValidInfrastructure: false,
        rejectionReason: "Unrelated image",
      },
    });
  });
  await controller.assess();
  expect(controller.getSnapshot()).toMatchObject({
    title: "Blocked community drain",
    attachments: [file()],
    error: "Unrelated image",
    assessment: null,
    rejection: { isValidInfrastructure: false },
  });
});
test("road-section publication sends server way ID and offsets, never a client AI score", async () => {
  const { controller, calls } = setup();
  const section = selectRoadSegment(road, 15, 95);
  controller.setLocation({
    mode: "road",
    point: pointAlong(section.coordinates, 40),
    road: section,
    name: "Demo road",
  });
  await controller.assess();
  await controller.publish();
  const body = calls.find((c) => c.path === "/api/community/posts")?.options
    ?.body;
  expect(body).toMatchObject({ road: { id: road.id, start: 15, end: 95 } });
  expect(body).not.toHaveProperty("analysis");
  expect(body).not.toHaveProperty("severity");
});
test("duplicate publish is guarded, and uncertain failures retry the same draft idempotently", async () => {
  const instance = setup();
  await instance.controller.assess();
  const p = instance.controller.publish();
  const duplicate = await instance.controller.publish();
  expect(duplicate).toBeNull();
  await p;
  expect(
    instance.calls.filter((c) => c.path === "/api/community/posts"),
  ).toHaveLength(1);
  let attempt = 0;
  const retry = setup(async (path, options) => {
    if (options?.method === "DELETE") return null;
    if (path.endsWith("/assess"))
      return {
        draftId,
        media: [
          {
            id: "cover",
            url: "/media/photo.jpg",
            kind: "photo",
            name: "photo.jpg",
            mimeType: "image/jpeg",
          },
        ],
        analysis,
        context: {
          headline: "Blocked community drain",
          caption: "Water pools after rain",
        },
      };
    if (++attempt === 1) throw new ApiError("Connection interrupted");
    return { id: "one-post", reportId: "one-hazard", grouped: false };
  });
  await retry.controller.assess();
  await retry.controller.publish();
  expect(retry.controller.getSnapshot().assessment?.draftId).toBe(draftId);
  await retry.controller.publish();
  const posts = retry.calls.filter((c) => c.path === "/api/community/posts");
  expect(posts[0].options?.body).toEqual(posts[1].options?.body);
});
test("expired drafts cannot be reused; closing cancels/discards owned unpublished evidence", async () => {
  const x = setup(async (path, options) => {
    if (options?.method === "DELETE") return null;
    if (path.endsWith("/assess"))
      return {
        draftId,
        media: [
          {
            id: "cover",
            url: "/media/photo.jpg",
            kind: "photo",
            name: "photo.jpg",
            mimeType: "image/jpeg",
          },
        ],
        analysis,
        context: {
          headline: "Blocked community drain",
          caption: "Water pools after rain",
        },
      };
    throw new ApiError("Draft expired", 410);
  });
  await x.controller.assess();
  await x.controller.publish();
  expect(x.controller.getSnapshot().assessment).toBeNull();
  expect(x.controller.getSnapshot().attachments).toHaveLength(1);
  await x.controller.assess();
  x.controller.dispose();
  await flush();
  expect(
    x.calls.some(
      (c) => c.path.endsWith(draftId) && c.options?.method === "DELETE",
    ),
  ).toBe(true);
});
test("road endpoint projection follows mapped bends and always respects 5–500 metres", () => {
  const initial = selectRoadSegment(road, 20, 100);
  for (const offset of [-100, 0, 10, 200, 1e6]) {
    const a = moveRoadEnd(road, initial, "start", offset),
      b = moveRoadEnd(road, initial, "end", offset);
    for (const s of [a, b]) {
      expect(s.length).toBeGreaterThanOrEqual(MIN_ROAD_METERS);
      expect(s.length).toBeLessThanOrEqual(MAX_ROAD_METERS);
      expect(s.start).toBeGreaterThanOrEqual(0);
      expect(s.end).toBeLessThanOrEqual(roadLength(road.coordinates));
    }
  }
  const near = nearestRoadPoint(road.coordinates, [14.289, 121.4101]);
  expect(near.distance).toBeLessThan(15);
  expect(
    meters(pointAlong(road.coordinates, near.offset), near.point),
  ).toBeLessThan(0.01);
});
test("map filters use canonical severity and priority, preserve separate co-located issues, and retain source links", () => {
  const hazard = (id: string, extra: object = {}) => ({
    id,
    title: "Demo drain",
    location: "Santa Cruz",
    latitude: 14.28,
    longitude: 121.41,
    distressType: "drainage_blockage",
    severity: 3,
    vruLethality: "LOW",
    status: "REPORTED",
    support: 8,
    observations: 2,
    priority: 5,
    createdAt: "2026-10-25T00:00:00Z",
    updatedAt: "2026-10-25T00:00:00Z",
    imageUrl: "/media/x.jpg",
    mediaKind: "photo",
    analysis,
    media: [],
    posts: [
      {
        id: "source",
        title: "Evidence",
        author: "Demo",
        createdAt: "2026-10-25T00:00:00Z",
        match: { reason: "Same visible defect" },
      },
    ],
    ...extra,
  });
  const data = parseMapSnapshot({
    hazards: [
      hazard("one"),
      hazard("two", { severity: 9, priority: 9, status: "IN_REPAIR" }),
    ],
    asOf: "2026-10-25T00:00:00Z",
  });
  expect(data.hazards).toHaveLength(2);
  expect(
    filterHazards(data.hazards, { ...emptyMapFilters, critical: true }).map(
      (h) => h.id,
    ),
  ).toEqual(["two"]);
  expect(
    filterHazards(data.hazards, {
      ...emptyMapFilters,
      status: "IN_REPAIR",
    }).map((h) => h.id),
  ).toEqual(["two"]);
  expect(filterHazards(data.hazards, emptyMapFilters)[1].severity).toBe(3);
  expect(data.hazards[0].posts[0]).toMatchObject({
    id: "source",
    reason: "Same visible defect",
  });
});

test("development effect replay leaves the composer active", async () => {
  const { controller, calls } = setup();
  controller.dispose();
  controller.activate();
  controller.edit("title", "Current field report");
  await controller.assess();
  expect(controller.getSnapshot().assessment?.context.headline).toBe(
    "Current field report",
  );
  expect(controller.getSnapshot().busy).toBeNull();
  expect(calls.filter((c) => c.path.endsWith("/assess"))).toHaveLength(1);
});
