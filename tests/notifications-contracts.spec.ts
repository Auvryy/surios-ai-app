import { test, expect } from "@playwright/test";
import { notificationCopy, notificationDestination, parseNotifications, parseReadNotification, unreadLabel } from "../src/lib/notifications";
import { uid, postId, siblingId, quoteId, stamp } from "./discussion-data";
const receipt = { id: uid(60), kind: "REPORT_RESOLVED", postId: siblingId, repostId: quoteId, commentId: null, postTitle: "Demo linked report", actor: { id: uid(61), name: "Demo municipal office" }, createdAt: stamp, readAt: null };
const page = () => ({ items: [{ ...receipt }], unreadCount: 1, hasMore: false, nextCursor: null });

test("a resolution retains the actual sibling post and government update destination", () => {
  const n = parseNotifications(page()).items[0];
  expect(notificationDestination(n)).toEqual({ pathname: "/post/[id]", params: { id: siblingId, repost: quoteId } });
  expect(notificationCopy(n).body).toContain("explanation and evidence");
});
test("source comments open their source while quote replies retain their separate discussion", () => {
  const p = { ...page(), items: [{ ...receipt, kind: "COMMENT", postId, repostId: null, commentId: uid(5) }] };
  const n = parseNotifications(p).items[0];
  expect(notificationDestination(n).params).toEqual({ id: postId });
  expect(notificationCopy(n).body).toContain("commented on your post");
  expect(notificationCopy({ ...n, kind: "REPLY", repostId: quoteId }).body).toContain("replied to your comment");
});
test("malformed counts, dates, target IDs, kinds and duplicate items are rejected", () => {
  for (const changes of [{ unreadCount: -1 }, { unreadCount: 0.5 }, { unreadCount: "1" }, { hasMore: true }, { nextCursor: "https://evil.test" }])
    expect(() => parseNotifications({ ...page(), ...changes })).toThrow();
  for (const changes of [{ id: "../../settings" }, { postId: "https://evil.test" }, { kind: "UNKNOWN" }, { readAt: "yesterday" }, { createdAt: "invalid" }, { repostId: null }, { actor: { id: uid(61), name: "" } }])
    expect(() => parseNotifications({ ...page(), items: [{ ...receipt, ...changes }] })).toThrow();
  expect(() => parseNotifications({ ...page(), items: [receipt, receipt] })).toThrow();
});
test("read success requires a confirmed receipt and a real unread count", () => {
  expect(parseReadNotification({ success: true, unreadCount: 0, readAt: stamp })).toEqual({ unreadCount: 0, readAt: stamp });
  for (const v of [{ success: false, unreadCount: 0, readAt: stamp }, { success: true, unreadCount: -1, readAt: stamp }, { success: true, unreadCount: 0 }])
    expect(() => parseReadNotification(v)).toThrow();
});
test("empty pages and deleted actors are legitimate and labels disclose the full count", () => {
  expect(parseNotifications({ items: [], unreadCount: 0, hasMore: false, nextCursor: null }).items).toEqual([]);
  const n = parseNotifications({ ...page(), items: [{ ...receipt, actor: null }] }).items[0];
  expect(notificationCopy(n).body).toContain("A community member");
  expect(unreadLabel(null)).toBe("Unread count unavailable"); expect(unreadLabel(1)).toBe("1 unread notification"); expect(unreadLabel(120)).toBe("120 unread notifications");
});
