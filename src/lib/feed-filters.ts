export type FeedQuery = {
  q: string;
  tab: "all" | "critical" | "liked";
  media: "all" | "photo" | "video";
  sort: "relevance" | "newest" | "oldest" | "severity" | "likes";
};

export const defaultFeedQuery: FeedQuery = { q: "", tab: "all", media: "all", sort: "newest" };

export function normalizeFeedQuery(input: FeedQuery): FeedQuery {
  const q = input.q.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 100);
  const tab = ["critical", "liked"].includes(input.tab) ? input.tab : "all";
  const sort = ["relevance", "newest", "oldest", "severity", "likes"].includes(input.sort) ? input.sort : "newest";
  return { q, tab,
    media: tab === "liked" || !["photo", "video"].includes(input.media) ? "all" : input.media,
    sort: tab === "liked" ? (q ? "relevance" : "newest") : sort === "relevance" && !q ? "newest" : sort,
  };
}

/** Query and ordering belong to the shared backend, including not-yet-loaded posts. */
export function feedRequest(input: FeedQuery, page = 1): string {
  const query = normalizeFeedQuery(input);
  const params = new URLSearchParams({ page: String(Math.min(50, Math.max(1, Math.floor(page) || 1))) });
  if (query.q) params.set("q", query.q);
  if (query.tab !== "all") params.set("tab", query.tab);
  if (query.media !== "all") params.set("media", query.media);
  params.set("sort", query.sort);
  return `/api/community/posts?${params}`;
}
