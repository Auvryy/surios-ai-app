import { isRecord } from "../auth/contracts";
import { ApiError } from "./api-client";
import {
  parseAnalysis,
  parseMedia,
  parseRoadSegment,
  type Analysis,
  type PostMedia,
} from "./report-contracts";
import { validCoordinate, type RoadSegment, type Coordinate } from "./roads";
export type MapSource = {
  id: string;
  title: string;
  author: string;
  createdAt: string;
  reason: string;
};
export type MapHazard = {
  id: string;
  title: string;
  location: string;
  latitude: number;
  longitude: number;
  distressType: string;
  severity: number;
  vruLethality: string;
  status: string;
  support: number;
  observations: number;
  priority: number;
  createdAt: string;
  updatedAt: string;
  imageUrl: string;
  mediaKind: "photo" | "video";
  analysis: Analysis;
  posts: MapSource[];
  media: PostMedia[];
  roadSegment: RoadSegment | null;
};
export type MapSnapshot = { hazards: MapHazard[]; asOf: string };
const invalid = () =>
  new ApiError("The server returned incomplete map data. Please try again.");
export function parseMapHazard(v: unknown): MapHazard {
  if (
    !isRecord(v) ||
    ![
      "id",
      "title",
      "location",
      "distressType",
      "vruLethality",
      "status",
      "createdAt",
      "updatedAt",
      "imageUrl",
    ].every((k) => typeof v[k] === "string") ||
    !["severity", "support", "observations", "priority"].every(
      (k) => typeof v[k] === "number" && Number.isFinite(v[k]),
    ) ||
    !validCoordinate([v.latitude, v.longitude]) ||
    !Array.isArray(v.posts) ||
    !Number.isFinite(Date.parse(String(v.updatedAt))) ||
    !Number.isFinite(Date.parse(String(v.createdAt)))
  )
    throw invalid();
  const posts = v.posts.map((post) => {
    if (
      !isRecord(post) ||
      !["id", "title", "author", "createdAt"].every(
        (k) => typeof post[k] === "string",
      )
    )
      throw invalid();
    return {
      id: String(post.id),
      title: String(post.title),
      author: String(post.author),
      createdAt: String(post.createdAt),
      reason:
        isRecord(post.match) && typeof post.match.reason === "string"
          ? post.match.reason
          : "",
    };
  });
  return {
    id: String(v.id),
    title: String(v.title),
    location: String(v.location),
    latitude: Number(v.latitude),
    longitude: Number(v.longitude),
    distressType: String(v.distressType),
    severity: Number(v.severity),
    vruLethality: String(v.vruLethality),
    status: String(v.status),
    support: Number(v.support),
    observations: Number(v.observations),
    priority: Number(v.priority),
    createdAt: String(v.createdAt),
    updatedAt: String(v.updatedAt),
    imageUrl: String(v.imageUrl),
    mediaKind: v.mediaKind === "video" ? "video" : "photo",
    analysis: parseAnalysis(v.analysis),
    posts,
    media: parseMedia(v.media),
    roadSegment: parseRoadSegment(v.roadSegment),
  };
}
export function parseMapSnapshot(value: unknown): MapSnapshot {
  if (
    !isRecord(value) ||
    !Array.isArray(value.hazards) ||
    typeof value.asOf !== "string" ||
    !Number.isFinite(Date.parse(value.asOf))
  )
    throw invalid();
  return { hazards: value.hazards.map(parseMapHazard), asOf: value.asOf };
}
export type MapFilters = {
  search: string;
  status: string;
  type: string;
  critical: boolean;
  exposure: boolean;
  sort: "priority" | "severity" | "newest" | "support";
};
export const emptyMapFilters: MapFilters = {
  search: "",
  status: "",
  type: "",
  critical: false,
  exposure: false,
  sort: "priority",
};
export function filterHazards(hazards: MapHazard[], f: MapFilters) {
  return hazards
    .filter(
      (h) =>
        (!f.status ||
          (f.status === "IN_REPAIR"
            ? ["IN_REPAIR", "DISPATCHED", "AWAITING_REVIEW"].includes(h.status)
            : h.status === f.status)) &&
        (!f.type || h.distressType === f.type) &&
        (!f.critical || h.severity >= 8) &&
        (!f.exposure || ["HIGH", "CRITICAL"].includes(h.vruLethality)) &&
        `${h.title} ${h.location} ${h.distressType} ${h.id}`
          .toLowerCase()
          .includes(f.search.trim().toLowerCase()),
    )
    .sort((a, b) =>
      f.sort === "newest"
        ? Date.parse(b.createdAt) - Date.parse(a.createdAt)
        : f.sort === "support"
          ? b.support - a.support || b.severity - a.severity
          : f.sort === "severity"
            ? b.severity - a.severity || b.support - a.support
            : b.priority - a.priority ||
              Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
}
export type MapRoute = {
  coordinates: Coordinate[];
  estimated: boolean;
  distance: string;
  duration: string;
  origin: string;
};
export function parseMapRoute(v: unknown): MapRoute {
  if (
    !isRecord(v) ||
    !isRecord(v.route) ||
    !Array.isArray(v.route.coordinates) ||
    !v.route.coordinates.every(validCoordinate) ||
    v.route.coordinates.length < 2
  )
    throw invalid();
  return {
    coordinates: v.route.coordinates,
    estimated: v.route.estimated === true,
    distance: String(v.route.distanceFormatted || ""),
    duration: String(v.route.durationFormatted || ""),
    origin: String(v.route.originName || "Municipal depot"),
  };
}
