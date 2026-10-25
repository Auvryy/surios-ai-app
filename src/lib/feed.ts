import { isRecord } from "../auth/contracts";
import { ApiError } from "./api-client";
import { parseMedia, type PostMedia } from "./report-contracts";

export type FeedCard = {
  id: string;
  title: string;
  body: string;
  author: string;
  authorAvatarUrl: string | null;
  createdAt: string;
  location: string;
  status: string;
  official: boolean;
  repost: boolean;
  photoUrl: string | null;
  photoCount: number;
  url: string;
  resolutionUrl: string | null;
  originalTitle: string | null;
  reportId: string | null;
  media: PostMedia[];
};
export type FeedPage = {
  feed: FeedCard[];
  hasMore: boolean;
  currentPage: number;
};

export function parseFeedPage(value: unknown): FeedPage {
  if (
    !isRecord(value) ||
    !Array.isArray(value.feed) ||
    typeof value.hasMore !== "boolean" ||
    !Number.isInteger(value.currentPage) ||
    Number(value.currentPage) < 1 ||
    Number(value.currentPage) > 50
  ) {
    throw new ApiError(
      "The server returned an invalid feed. Please try again.",
    );
  }
  const feed = value.feed.map((entry): FeedCard => {
    if (!isRecord(entry) || !["post", "repost"].includes(String(entry.kind)))
      throw new ApiError("The server returned an invalid post.");
    const quote = entry.kind === "repost" ? entry.repost : null;
    const post = isRecord(quote) ? quote.post : entry.post;
    const source = isRecord(quote) ? quote : post;
    if (
      !isRecord(post) ||
      !isRecord(source) ||
      !isRecord(source.author) ||
      typeof source.id !== "string" ||
      typeof source.author.name !== "string" ||
      typeof post.id !== "string" ||
      typeof post.title !== "string" ||
      typeof source.body !== "string" ||
      typeof source.createdAt !== "string" ||
      !Number.isFinite(Date.parse(source.createdAt))
    ) {
      throw new ApiError("The server returned an invalid post.");
    }
    const media = Array.isArray(source.media)
      ? source.media.filter(isRecord)
      : [];
    const update =
      isRecord(quote) && isRecord(quote.governmentUpdate)
        ? quote.governmentUpdate
        : null;
    const attachments =
      update && Array.isArray(update.attachments)
        ? update.attachments.filter(isRecord)
        : [];
    const photos = [
      ...new Map(
        [...media, ...attachments]
          .filter(
            (item) => item.kind === "photo" && typeof item.url === "string",
          )
          .map((item) => [item.url, item]),
      ).values(),
    ];
    const cover = photos.find((item) => item.id === post.coverId) || photos[0];
    const official = isRecord(quote) && isRecord(quote.governmentUpdate);
    return {
      id: `${entry.kind}:${source.id}`,
      title: isRecord(quote)
        ? official
          ? "Government update"
          : "Shared report"
        : post.title,
      body: source.body,
      author: source.author.name,
      authorAvatarUrl: typeof source.author.avatarUrl === "string" ? source.author.avatarUrl : null,
      createdAt: source.createdAt,
      location: typeof post.locationName === "string" ? post.locationName : "",
      status: typeof post.reportStatus === "string" ? post.reportStatus : "",
      official,
      repost: isRecord(quote),
      photoUrl: cover ? String(cover.url) : null,
      photoCount: photos.length,
      url: `/community/post/${encodeURIComponent(post.id)}${isRecord(quote) ? `?repost=${encodeURIComponent(String(quote.id))}#repost-${encodeURIComponent(String(quote.id))}` : ""}`,
      resolutionUrl:
        typeof post.governmentUpdateLink === "string"
          ? post.governmentUpdateLink
          : null,
      originalTitle: isRecord(quote) ? post.title : null,
      reportId: typeof post.reportId === "string" ? post.reportId : null,
      media: parseMedia([
        ...new Map(
          [
            ...media,
            ...attachments.filter((item) => item.kind === "photo"),
          ].map((item) => [item.url, item]),
        ).values(),
      ]),
    };
  });
  return {
    feed,
    hasMore: value.hasMore,
    currentPage: Number(value.currentPage),
  };
}

export function publicUrl(path: string, origin: string): string {
  const url = new URL(path, origin);
  if (!["https:", "http:"].includes(url.protocol) || url.origin !== origin)
    throw new ApiError("Invalid SuriOS link.");
  return url.toString();
}
