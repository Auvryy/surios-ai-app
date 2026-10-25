import type { ApiOptions } from "../lib/api-client";
import type { Coordinate, RoadSegment } from "../lib/roads";
export type Request = <T>(
  path: string,
  options?: Omit<ApiOptions, "token">,
) => Promise<T>;
export type Attachment = {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  file?: File;
};
export type ReportLocation = {
  mode: "point" | "road";
  point: Coordinate | null;
  road: RoadSegment | null;
  name: string;
};
export const PHOTO_LIMIT = 5 * 1024 * 1024;
export const VIDEO_LIMIT = 25 * 1024 * 1024;
export function mediaError(files: Attachment[]) {
  if (files.length > 6) return "Choose up to 6 photos or videos.";
  if (
    files.some(
      (f) =>
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
          "video/mp4",
          "video/webm",
          "video/quicktime",
        ].includes(f.mimeType),
    )
  )
    return "Use JPEG, PNG, WebP, MP4, WebM, or MOV files.";
  if (files.some((f) => !Number.isFinite(f.size) || f.size <= 0))
    return "The file could not be read. Choose it again.";
  if (
    files.some(
      (f) =>
        f.size > (f.mimeType.startsWith("video/") ? VIDEO_LIMIT : PHOTO_LIMIT),
    )
  )
    return "Images must be 5 MB or less; videos must be 25 MB or less.";
  if (files.reduce((sum, f) => sum + f.size, 0) > 50 * 1024 * 1024)
    return "Attachments must total 50 MB or less.";
  return "";
}
