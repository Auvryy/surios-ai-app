import { isRecord } from "../auth/contracts";
import { ApiError } from "./api-client";
import { validCoordinate, type RoadWay, type RoadSegment } from "./roads";

export type Evidence = {
  visibleDefects: string[];
  reportedConditions: string[];
  criticalDangerVisible: boolean;
  confidence: string;
  limitations: string;
};
export type Analysis = {
  isValidInfrastructure: boolean;
  rejectionReason?: string;
  infrastructureType: string;
  distressType: string;
  hazardSeverity: number;
  riskLevel: string;
  summary: string;
  recommendedAction: string;
  vruDetails: string;
  severityEvidence: Evidence | null;
};
export type PostMedia = {
  id: string;
  url: string;
  kind: "photo" | "video";
  name: string;
  mimeType: string;
};
export type Assessment = {
  draftId: string;
  media: PostMedia[];
  analysis: Analysis;
  context: { headline: string; caption: string };
};
export type PublishedReport = {
  id: string;
  reportId: string;
  grouped: boolean;
};
export const humanize = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
export const statusLabel = (status: string) =>
  status === "RESOLVED"
    ? "Resolved"
    : ["DISPATCHED", "IN_REPAIR", "AWAITING_REVIEW"].includes(status)
      ? "In progress"
      : "Reported";
const invalid = () =>
  new ApiError("The server returned incomplete report data. Please try again.");
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
export function parseAnalysis(value: unknown): Analysis {
  if (
    !isRecord(value) ||
    typeof value.isValidInfrastructure !== "boolean" ||
    !Number.isInteger(value.hazardSeverity) ||
    Number(value.hazardSeverity) < 1 ||
    Number(value.hazardSeverity) > 10 ||
    typeof value.distressType !== "string" ||
    typeof value.summary !== "string"
  )
    throw invalid();
  const evidence = isRecord(value.severityEvidence)
    ? value.severityEvidence
    : null;
  return {
    isValidInfrastructure: value.isValidInfrastructure,
    rejectionReason:
      typeof value.rejectionReason === "string"
        ? value.rejectionReason
        : undefined,
    infrastructureType:
      typeof value.infrastructureType === "string"
        ? value.infrastructureType
        : "OTHER_PUBLIC_INFRASTRUCTURE",
    distressType: value.distressType,
    hazardSeverity: Number(value.hazardSeverity),
    riskLevel: String(value.riskLevel || ""),
    summary: value.summary,
    recommendedAction:
      typeof value.recommendedAction === "string"
        ? value.recommendedAction
        : "",
    vruDetails: typeof value.vruDetails === "string" ? value.vruDetails : "",
    severityEvidence: evidence
      ? {
          visibleDefects: strings(evidence.visibleDefects),
          reportedConditions: strings(evidence.reportedConditions),
          criticalDangerVisible: evidence.criticalDangerVisible === true,
          confidence: String(evidence.confidence || ""),
          limitations: String(evidence.limitations || ""),
        }
      : null,
  };
}
export function parseMedia(value: unknown): PostMedia[] {
  if (!Array.isArray(value)) throw invalid();
  return value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.url !== "string" ||
      !["photo", "video"].includes(String(item.kind)) ||
      typeof item.name !== "string" ||
      typeof item.mimeType !== "string"
    )
      throw invalid();
    return {
      id: item.id,
      url: item.url,
      kind: item.kind as "photo" | "video",
      name: item.name,
      mimeType: item.mimeType,
    };
  });
}
export function parseAssessment(value: unknown, count: number): Assessment {
  if (
    !isRecord(value) ||
    typeof value.draftId !== "string" ||
    !isRecord(value.context) ||
    typeof value.context.headline !== "string" ||
    typeof value.context.caption !== "string"
  )
    throw invalid();
  const analysis = parseAnalysis(value.analysis),
    media = parseMedia(value.media);
  if (
    !analysis.isValidInfrastructure ||
    media.length !== count ||
    !media.length
  )
    throw invalid();
  return {
    draftId: value.draftId,
    media,
    analysis,
    context: {
      headline: value.context.headline,
      caption: value.context.caption,
    },
  };
}
export function parseRoad(value: unknown): RoadWay {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !/^[1-9][0-9]{0,14}$/.test(value.id) ||
    typeof value.name !== "string" ||
    !Array.isArray(value.coordinates) ||
    value.coordinates.length < 2 ||
    !value.coordinates.every(validCoordinate)
  )
    throw invalid();
  return { id: value.id, name: value.name, coordinates: value.coordinates };
}
export function parseRoads(value: unknown): RoadWay[] {
  if (!isRecord(value) || !Array.isArray(value.roads)) throw invalid();
  return value.roads.map(parseRoad);
}
export function parseRoadSegment(value: unknown): RoadSegment | null {
  if (value == null) return null;
  const road = parseRoad(value);
  if (
    !isRecord(value) ||
    typeof value.start !== "number" ||
    typeof value.end !== "number" ||
    typeof value.length !== "number" ||
    ![value.start, value.end, value.length].every(Number.isFinite) ||
    value.start < 0 ||
    value.end < value.start ||
    value.length <= 0
  )
    throw invalid();
  return { ...road, start: value.start, end: value.end, length: value.length };
}
export function parsePublished(value: unknown): PublishedReport {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.reportId !== "string" ||
    typeof value.grouped !== "boolean"
  )
    throw invalid();
  return { id: value.id, reportId: value.reportId, grouped: value.grouped };
}
