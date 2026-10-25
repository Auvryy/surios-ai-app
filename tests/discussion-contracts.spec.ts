import { test, expect } from "@playwright/test";
import {
  commentError,
  confirmComment,
  confirmReaction,
  confirmRepost,
  parseThread,
  postDestination,
  postPath,
} from "../src/lib/discussion";
import {
  source,
  official,
  postId,
  quoteId,
  siblingId,
  uid,
} from "./discussion-data";
test("thread parsing preserves canonical state, historical update state and separate discussions across linked observations", () => {
  const thread = parseThread({ post: source(), reposts: [official()] }, postId);
  expect(thread.post.reportStatus).toBe("RESOLVED");
  expect(thread.post.reportSeverity).toBe(2);
  expect(thread.post.analysis.hazardSeverity).toBe(3);
  expect(thread.reposts[0].governmentUpdate?.status).toBe("IN_PROGRESS");
  expect(thread.reposts[0].post.id).toBe(siblingId);
  expect(thread.post.comments[0].body).toBe("Demo saved comment");
  expect(thread.reposts[0].comments[0].body).toBe("Demo update-only comment");
  expect(thread.reposts[0].governmentUpdate?.attachments[1].kind).toBe(
    "document",
  );
});
test("malformed, mismatched and unrelated thread data are rejected instead of inventing state", () => {
  for (const post of [
    { ...source(), id: uid(99) },
    { ...source(), userConfirmed: "false" },
    { ...source(), comments: [{ ...source().comments[0], likes: -1 }] },
    { ...source(), reportSeverity: 11 },
    { ...source(), media: [{}] },
  ])
    expect(() => parseThread({ post, reposts: [] }, postId)).toThrow();
  expect(() =>
    parseThread(
      {
        post: source(),
        reposts: [
          { ...official(), post: { ...source(siblingId), reportId: uid(99) } },
        ],
      },
      postId,
    ),
  ).toThrow();
  expect(() =>
    parseThread({ post: source(), reposts: [official(), official()] }, postId),
  ).toThrow();
});
test("post links retain the selected update, constrain the origin and reject invalid identifiers", () => {
  const origin = "https://surios.example.test";
  expect(postDestination(postPath(postId, quoteId), origin)).toEqual({
    pathname: "/post/[id]",
    params: { id: postId, repost: quoteId },
  });
  expect(postDestination(postPath(postId), origin)?.params).toEqual({
    id: postId,
  });
  expect(postDestination("/community/post/invalid", origin)).toBeNull();
  expect(
    postDestination(`/community/post/${postId}?repost=invalid`, origin),
  ).toBeNull();
  expect(() =>
    postDestination(`https://evil.example/community/post/${postId}`, origin),
  ).toThrow();
  expect(() => postPath("../settings")).toThrow();
});
test("comment boundaries and mutation acknowledgements require confirmed saved identifiers and reaction state", () => {
  expect(commentError("   ")).toBeTruthy();
  expect(commentError(" x ")).toBeNull();
  expect(commentError("x".repeat(1000))).toBeNull();
  expect(commentError("x".repeat(1001))).toBeTruthy();
  expect(confirmComment({ comment: { id: uid(90) } }, true)).toBe(uid(90));
  expect(confirmComment({ id: uid(91) }, false)).toBe(uid(91));
  expect(() => confirmComment({ success: true }, false)).toThrow();
  expect(
    confirmReaction({ confirmations: 8, userConfirmed: true }, true, true),
  ).toEqual({ likes: 8, userLiked: true });
  expect(() =>
    confirmReaction({ likes: 8, userLiked: false }, true, false),
  ).toThrow();
  expect(() =>
    confirmRepost({ id: uid(90), postId }, uid(91), postId),
  ).toThrow();
  expect(() =>
    confirmRepost({ id: uid(90), postId }, uid(90), postId),
  ).not.toThrow();
});
