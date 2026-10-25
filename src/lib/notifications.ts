import { ApiError } from "./api-client";
import { isRecord } from "../auth/contracts";
import { validId } from "./discussion";

export type NotificationKind = "REPORT_PROGRESS" | "REPORT_RESOLVED" | "COMMENT" | "REPLY";
export type InboxNotification = {
  id: string; kind: NotificationKind; postId: string; repostId: string | null;
  commentId: string | null; postTitle: string;
  actor: { id: string; name: string } | null;
  createdAt: string; readAt: string | null;
};
export type NotificationPage = { items: InboxNotification[]; unreadCount: number; hasMore: boolean; nextCursor: string | null };
const invalid = () => new ApiError("Your notifications could not be verified. Please refresh and try again.");
const date = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v));
const count = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const optionalId = (v: unknown): v is string | null => v === null || validId(v);

export function parseNotifications(value: unknown): NotificationPage {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > 50 ||
    !count(value.unreadCount) || typeof value.hasMore !== "boolean" ||
    !(value.nextCursor === null || typeof value.nextCursor === "string" && /^[A-Za-z0-9_-]{1,300}$/.test(value.nextCursor)) ||
    value.hasMore !== (value.nextCursor !== null) || value.hasMore && !value.items.length) throw invalid();
  const items = value.items.map((n): InboxNotification => {
    if (!isRecord(n) || !validId(n.id) || !validId(n.postId) || !optionalId(n.repostId) || !optionalId(n.commentId) ||
      !["REPORT_PROGRESS", "REPORT_RESOLVED", "COMMENT", "REPLY"].includes(String(n.kind)) ||
      typeof n.postTitle !== "string" || !n.postTitle.trim() || !date(n.createdAt) || !(n.readAt === null || date(n.readAt))) throw invalid();
    if ((n.kind === "REPORT_PROGRESS" || n.kind === "REPORT_RESOLVED") && !n.repostId) throw invalid();
    if ((n.kind === "COMMENT" || n.kind === "REPLY") && !n.commentId) throw invalid();
    let actor: InboxNotification["actor"] = null;
    if (n.actor !== null) {
      if (!isRecord(n.actor) || !validId(n.actor.id) || typeof n.actor.name !== "string" || !n.actor.name.trim()) throw invalid();
      actor = { id: n.actor.id, name: n.actor.name };
    }
    return { id: n.id, kind: n.kind as NotificationKind, postId: n.postId, repostId: n.repostId, commentId: n.commentId,
      postTitle: n.postTitle, actor, createdAt: n.createdAt, readAt: n.readAt };
  });
  if (new Set(items.map((n) => n.id)).size !== items.length) throw invalid();
  return { items, unreadCount: value.unreadCount, hasMore: value.hasMore, nextCursor: value.nextCursor as string | null };
}
export function parseReadNotification(value: unknown) {
  if (!isRecord(value) || value.success !== true || !count(value.unreadCount) || !date(value.readAt)) throw invalid();
  return { unreadCount: value.unreadCount, readAt: value.readAt };
}
export function notificationDestination(n: InboxNotification) {
  if (!validId(n.postId) || !optionalId(n.repostId)) throw invalid();
  return { pathname: "/post/[id]" as const, params: { id: n.postId, ...(n.repostId ? { repost: n.repostId } : {}) } };
}
export function notificationCopy(n: InboxNotification) {
  const name = n.actor?.name || "A community member";
  switch (n.kind) {
    case "REPORT_PROGRESS": return { title: "Work in progress", body: `${name} posted a progress update for a hazard you reported.`, icon: "tool" as const };
    case "REPORT_RESOLVED": return { title: "Report resolved", body: `${name} marked a hazard you reported as resolved. View the explanation and evidence.`, icon: "check-circle" as const };
    case "REPLY": return { title: "New reply", body: `${name} replied to your comment.`, icon: "corner-up-left" as const };
    case "COMMENT": return { title: "New comment", body: `${name} commented on your ${n.repostId ? "update" : "post"}.`, icon: "message-circle" as const };
  }
}
export const unreadLabel = (count: number | null) => count === null ? "Unread count unavailable" : `${count} unread ${count === 1 ? "notification" : "notifications"}`;
