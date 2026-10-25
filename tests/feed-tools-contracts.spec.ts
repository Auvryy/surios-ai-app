import { test, expect } from "@playwright/test";
import { defaultFeedQuery, feedRequest, normalizeFeedQuery } from "../src/lib/feed-filters";
import { parseFeedPage } from "../src/lib/feed";
import { contributorDestination, parseProfilePage, parsePublicProfilePage } from "../src/lib/profile";
import { canDeletePost, confirmDeletion, deletionRequest } from "../src/lib/post-deletion";
import { source, official, user, neighbour, uid } from "./discussion-data";

test("search encodes user input and sends full-dataset filters with bounded cumulative pages", () => {
  const query = normalizeFeedQuery({ ...defaultFeedQuery, q: "  Ｂridge  & canal\nSanta Cruz  ", tab: "critical", media: "photo", sort: "severity" });
  const url = new URL(feedRequest(query, 2), "https://server.test");
  expect(url.pathname).toBe("/api/community/posts");
  expect(Object.fromEntries(url.searchParams)).toEqual({ page: "2", q: "Bridge & canal Santa Cruz", tab: "critical", media: "photo", sort: "severity" });
  expect(new URL(feedRequest(query, Infinity), url).searchParams.get("page")).toBe("50");
  expect(new URL(feedRequest(query, -10), url).searchParams.get("page")).toBe("1");
  expect(normalizeFeedQuery({ ...query, q: "a".repeat(200) }).q).toHaveLength(100);
});

test("liked queries follow the backend's own-user ordering and media rules", () => {
  expect(normalizeFeedQuery({ ...defaultFeedQuery, tab: "liked", media: "video", sort: "likes" }))
    .toEqual({ ...defaultFeedQuery, tab: "liked" });
  expect(normalizeFeedQuery({ ...defaultFeedQuery, tab: "liked", q: "cover", media: "photo", sort: "oldest" }))
    .toEqual({ ...defaultFeedQuery, tab: "liked", q: "cover", sort: "relevance" });
  expect(normalizeFeedQuery({ ...defaultFeedQuery, sort: "relevance" }).sort).toBe("newest");
});

test("feed metadata distinguishes original ownership from repost and government authors", () => {
  const post = source(), quote = official();
  const page = parseFeedPage({ feed: [{ kind: "post", post }, { kind: "repost", repost: quote }], total: 2, hasMore: false, currentPage: 1 });
  expect(page.total).toBe(2);
  expect(page.feed[0]).toMatchObject({ recordId: post.id, postId: post.id, authorId: user.id, deleted: false, official: false });
  expect(page.feed[1]).toMatchObject({ recordId: quote.id, postId: quote.post.id, authorId: quote.author.id, official: true, repost: true });
  expect(() => parseFeedPage({ feed: [], total: -1, currentPage: 1, hasMore: false })).toThrow();
});

const publicPage = () => ({ profile: { ...neighbour, email: "private@example.test", coverUrl: "/media/cover.png", governmentProfile: null },
  isOwner: false, total: 0, statistics: null, feed: [], hasMore: false, currentPage: 1 });

test("public profiles retain only public identity and cannot become the own-account editor", () => {
  const result = parsePublicProfilePage(publicPage(), neighbour.id, user.id, "https://server.test");
  expect(result.isOwner).toBe(false);
  expect(result.profile).not.toHaveProperty("email");
  expect(result.profile.coverUrl).toBe("https://server.test/media/cover.png");
  expect(() => parseProfilePage(publicPage(), user.id, "https://server.test")).toThrow();
  expect(contributorDestination(neighbour.id)).toEqual({ pathname: "/citizen", params: { profile: neighbour.id } });
});

test("profile identity and ownership are checked even for a plausible public response", () => {
  expect(() => parsePublicProfilePage(publicPage(), uid(999), user.id, "https://server.test")).toThrow();
  expect(() => parsePublicProfilePage({ ...publicPage(), isOwner: true }, neighbour.id, user.id, "https://server.test")).toThrow();
  expect(() => parsePublicProfilePage(publicPage(), "../profile", user.id, "https://server.test")).toThrow();
  expect(() => contributorDestination("https://outside.test")).toThrow();
});

test("delete requests target the owned record, exclude official history and require exact receipts", () => {
  const post = { id: uid(1), kind: "post" as const, authorId: user.id, deleted: false, official: false };
  expect(canDeletePost(post, user.id)).toBe(true);
  expect(deletionRequest(post, user.id)).toBe(`/api/community/posts/${post.id}`);
  expect(deletionRequest({ ...post, kind: "repost", id: uid(20) }, user.id)).toBe(`/api/community/reposts?id=${uid(20)}`);
  for (const target of [{ ...post, authorId: neighbour.id }, { ...post, official: true }, { ...post, deleted: true }, { ...post, id: "../another" }]) {
    expect(canDeletePost(target, user.id)).toBe(false);
    expect(() => deletionRequest(target, user.id)).toThrow();
  }
  expect(() => confirmDeletion({ deleted: true, retainedHazard: true }, "post")).not.toThrow();
  expect(() => confirmDeletion({ removed: true }, "repost")).not.toThrow();
  for (const response of [null, { deleted: true }, { deleted: false, retainedHazard: true }, { removed: true }])
    expect(() => confirmDeletion(response, "post")).toThrow();
});
