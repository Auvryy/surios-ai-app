import { isRecord } from "@/auth/contracts";
import { ApiError } from "./api-client";
import { publicUrl } from "./feed";
import {
  parseAnalysis,
  parseMedia,
  type Analysis,
  type PostMedia,
} from "./report-contracts";

export type Author = {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: string;
};
export type Comment = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  author: Author;
  likes: number;
  userLiked: boolean;
};
export type Attachment = {
  id: string;
  url: string;
  name: string;
  kind: "photo" | "document";
  mimeType: string;
};
export type OfficialUpdate = {
  status: "IN_PROGRESS" | "RESOLVED";
  budgetType: "ESTIMATED" | "ACTUAL";
  budget: { label: string; amount: number }[];
  attachments: Attachment[];
};
export type DiscussionPost = {
  id: string;
  title: string;
  body: string;
  locationName: string;
  reportId: string;
  reportStatus: string;
  reportSeverity: number;
  reportRiskLevel: string;
  governmentUpdateLink: string | null;
  createdAt: string;
  deleted: boolean;
  author: Author;
  media: PostMedia[];
  analysis: Analysis;
  confirmations: number;
  userConfirmed: boolean;
  reposts: number;
  comments: Comment[];
};
export type Repost = {
  id: string;
  body: string;
  createdAt: string;
  author: Author;
  media: PostMedia[];
  post: DiscussionPost;
  governmentUpdate: OfficialUpdate | null;
  quotedRepostId: string | null;
  quotedRepost: Repost | null;
  likes: number;
  userLiked: boolean;
  reposts: number;
  comments: Comment[];
};
export type Thread = { post: DiscussionPost; reposts: Repost[] };
const invalid = () =>
  new ApiError("The post could not be read. Please refresh and try again.");
export const validId = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const count = (v: unknown) => {
  if (!Number.isSafeInteger(v) || Number(v) < 0) throw invalid();
  return Number(v);
};
const bool = (v: unknown) => {
  if (typeof v !== "boolean") throw invalid();
  return v;
};
const str = (v: unknown) => {
  if (typeof v !== "string") throw invalid();
  return v;
};
const id = (v: unknown) => {
  if (!validId(v)) throw invalid();
  return v;
};
const date = (v: unknown) => {
  const s = str(v);
  if (!Number.isFinite(Date.parse(s))) throw invalid();
  return s;
};
function author(v: unknown): Author {
  if (!isRecord(v)) throw invalid();
  return {
    id: id(v.id),
    name: str(v.name),
    avatarUrl: v.avatarUrl == null ? null : str(v.avatarUrl),
    role: typeof v.role === "string" ? v.role : "",
  };
}
function comments(v: unknown): Comment[] {
  if (!Array.isArray(v)) throw invalid();
  const result = v.map((c): Comment => {
    if (!isRecord(c)) throw invalid();
    return {
      id: id(c.id),
      parentId: c.parentId == null ? null : id(c.parentId),
      body: str(c.body),
      createdAt: date(c.createdAt),
      author: author(c.author),
      likes: count(c.likes),
      userLiked: bool(c.userLiked),
    };
  });
  if (new Set(result.map((c) => c.id)).size !== result.length) throw invalid();
  return result;
}
function post(v: unknown): DiscussionPost {
  if (!isRecord(v)) throw invalid();
  const analysis = parseAnalysis(v.analysis);
  const severity =
    v.reportSeverity == null
      ? analysis.hazardSeverity
      : Number(v.reportSeverity);
  if (!Number.isInteger(severity) || severity < 1 || severity > 10)
    throw invalid();
  return {
    id: id(v.id),
    title: str(v.title),
    body: str(v.body),
    locationName: str(v.locationName),
    reportId: id(v.reportId),
    reportStatus: str(v.reportStatus),
    reportSeverity: severity,
    reportRiskLevel:
      typeof v.reportRiskLevel === "string"
        ? v.reportRiskLevel
        : analysis.riskLevel,
    governmentUpdateLink:
      v.governmentUpdateLink == null ? null : str(v.governmentUpdateLink),
    createdAt: date(v.createdAt),
    deleted: v.deletedAt != null,
    author: author(v.author),
    media: parseMedia(v.media),
    analysis,
    confirmations: count(v.confirmations),
    userConfirmed: bool(v.userConfirmed),
    reposts: count(v.reposts),
    comments: comments(v.comments),
  };
}
function official(v: unknown): OfficialUpdate | null {
  if (v == null) return null;
  if (
    !isRecord(v) ||
    !["IN_PROGRESS", "RESOLVED"].includes(String(v.status)) ||
    !["ESTIMATED", "ACTUAL"].includes(String(v.budgetType)) ||
    !Array.isArray(v.budget) ||
    !Array.isArray(v.attachments)
  )
    throw invalid();
  return {
    status: v.status as OfficialUpdate["status"],
    budgetType: v.budgetType as OfficialUpdate["budgetType"],
    budget: v.budget.map((b) => {
      if (
        !isRecord(b) ||
        typeof b.amount !== "number" ||
        !Number.isFinite(b.amount) ||
        b.amount < 0
      )
        throw invalid();
      return { label: str(b.label), amount: b.amount };
    }),
    attachments: v.attachments.map((a) => {
      if (!isRecord(a) || !["photo", "document"].includes(String(a.kind)))
        throw invalid();
      return {
        id: str(a.id),
        url: str(a.url),
        name: str(a.name),
        mimeType: str(a.mimeType),
        kind: a.kind as Attachment["kind"],
      };
    }),
  };
}
function repost(v: unknown, depth = 0): Repost {
  if (!isRecord(v) || depth > 1) throw invalid();
  return {
    id: id(v.id),
    body: str(v.body),
    createdAt: date(v.createdAt),
    author: author(v.author),
    media: parseMedia(v.media),
    post: post(v.post),
    governmentUpdate: official(v.governmentUpdate),
    quotedRepostId: v.quotedRepostId == null ? null : id(v.quotedRepostId),
    quotedRepost:
      v.quotedRepost == null ? null : repost(v.quotedRepost, depth + 1),
    likes: count(v.likes),
    userLiked: bool(v.userLiked),
    reposts: count(v.reposts),
    comments: comments(v.comments),
  };
}
export function parseThread(
  v: unknown,
  expectedId: string,
  origin = "https://surios.example.test",
): Thread {
  if (!isRecord(v) || !Array.isArray(v.reposts)) throw invalid();
  const result = {
    post: post(v.post),
    reposts: v.reposts.map((r) => repost(r)),
  };
  // Official updates may originate on another observation of this same hazard.
  if (
    result.post.id !== expectedId ||
    result.reposts.some((r) => r.post.reportId !== result.post.reportId) ||
    new Set(result.reposts.map((r) => r.id)).size !== result.reposts.length
  )
    throw invalid();
  const checkPost = (p: DiscussionPost) =>
    p.media.forEach((m) => publicUrl(m.url, origin));
  const checkQuote = (r: Repost) => {
    checkPost(r.post);
    r.media.forEach((m) => publicUrl(m.url, origin));
    r.governmentUpdate?.attachments.forEach((a) => publicUrl(a.url, origin));
    if (r.quotedRepost) checkQuote(r.quotedRepost);
  };
  checkPost(result.post);
  result.reposts.forEach(checkQuote);
  return result;
}
export function postPath(postId: string, repostId?: string | null) {
  if (!validId(postId) || (repostId != null && !validId(repostId)))
    throw new ApiError("Invalid post link.");
  return `/community/post/${postId}${repostId ? `?repost=${repostId}#repost-${repostId}` : ""}`;
}
export function postDestination(
  path: string,
  origin: string,
): { pathname: "/post/[id]"; params: { id: string; repost?: string } } | null {
  const url = new URL(publicUrl(path, origin));
  const match = /^\/community\/post\/([^/]+)$/.exec(url.pathname);
  const quote = url.searchParams.get("repost");
  if (!match || !validId(match[1]) || (quote != null && !validId(quote)))
    return null;
  return {
    pathname: "/post/[id]",
    params: { id: match[1], ...(quote ? { repost: quote } : {}) },
  };
}
export const commentError = (body: string) =>
  !body.trim() || body.trim().length > 1000
    ? "Write a comment between 1 and 1,000 characters."
    : null;
export function confirmReaction(v: unknown, liked: boolean, source: boolean) {
  if (!isRecord(v) || (source ? v.userConfirmed : v.userLiked) !== liked)
    throw new ApiError(
      "The reaction was not confirmed. Refresh before trying again.",
    );
  return { likes: count(source ? v.confirmations : v.likes), userLiked: liked };
}
export function confirmComment(v: unknown, source: boolean): string {
  const c = isRecord(v) && source ? v.comment : v;
  if (!isRecord(c) || !validId(c.id))
    throw new ApiError(
      "The comment was not confirmed. Refresh the discussion before sending it again.",
    );
  return c.id;
}
export function confirmRepost(v: unknown, expectedId: string, postId: string) {
  if (!isRecord(v) || v.id !== expectedId || v.postId !== postId)
    throw new ApiError(
      "The repost was not confirmed. Retry with this same draft.",
    );
}
