import { isRecord, type UserRole } from "../auth/contracts";
import { ApiError } from "./api-client";
import { parseFeedPage, type FeedPage } from "./feed";
import { validId } from "./discussion";

export type GovernmentProfile = {
  level: "MUNICIPAL" | "BARANGAY";
  jurisdiction: string;
  bio: string;
};
export type PublicProfile = {
  id: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  coverUrl: string | null;
  governmentProfile: GovernmentProfile | null;
};
export type ProfilePage = Omit<FeedPage, "total"> & {
  profile: PublicProfile;
  isOwner: boolean;
  total: number;
  statistics: { reports: number; inProgress: number; resolved: number } | null;
};
export type ProfilePhoto = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  file?: File;
};
export type ProfileChanges = {
  name: string;
  avatar: ProfilePhoto | null;
  cover: ProfilePhoto | null;
  removeAvatar: boolean;
  removeCover: boolean;
  governmentProfile?: GovernmentProfile;
};
export const PROFILE_PHOTO_LIMIT = 4 * 1024 * 1024;

export function isGovernment(role: UserRole) {
  return role === "OFFICER" || role === "ENGINEER" || role === "ADMIN";
}

/** Profile photos are public server-managed media, never authenticated API URLs. */
export function profileImageUrl(value: unknown, origin: string): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value, origin);
    return url.origin === origin && !url.username && !url.password &&
      url.pathname.startsWith("/media/") && ["http:", "https:"].includes(url.protocol)
      ? url.toString() : null;
  } catch { return null; }
}

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function readProfilePage(value: unknown, expectedId: string, viewerId: string, origin: string): ProfilePage {
  if (!isRecord(value) || !isRecord(value.profile) || typeof value.isOwner !== "boolean" || !count(value.total))
    throw new ApiError("Your profile could not be read. Please try again.");
  const profile = value.profile;
  if (typeof profile.id !== "string" || !profile.id || typeof profile.name !== "string" || !profile.name.trim() ||
      !["CITIZEN", "OFFICER", "ENGINEER", "ADMIN"].includes(String(profile.role)) ||
      profile.id !== expectedId || value.isOwner !== (profile.id === viewerId))
    throw new ApiError("The server returned a different profile. Please reload your account.");
  const role = profile.role as UserRole;
  let governmentProfile: GovernmentProfile | null = null;
  if (isGovernment(role) && profile.governmentProfile != null) {
    const office = profile.governmentProfile;
    if (!isRecord(office) || !["MUNICIPAL", "BARANGAY"].includes(String(office.level)) ||
        typeof office.jurisdiction !== "string" || typeof office.bio !== "string")
      throw new ApiError("The server returned invalid office details. Please try again.");
    governmentProfile = { level: office.level as GovernmentProfile["level"], jurisdiction: office.jurisdiction, bio: office.bio };
  }
  let statistics: ProfilePage["statistics"] = null;
  if (isGovernment(role) && value.statistics != null) {
    const stats = value.statistics;
    if (!isRecord(stats) || !count(stats.reports) || !count(stats.inProgress) || !count(stats.resolved))
      throw new ApiError("The server returned invalid report statistics. Please try again.");
    statistics = { reports: stats.reports, inProgress: stats.inProgress, resolved: stats.resolved };
  }
  return {
    ...parseFeedPage(value),
    profile: { id: profile.id, name: profile.name, role,
      avatarUrl: profileImageUrl(profile.avatarUrl, origin), coverUrl: profileImageUrl(profile.coverUrl, origin), governmentProfile },
    isOwner: value.isOwner, total: value.total, statistics,
  };
}

/** Own-account editing keeps its original strict identity/ownership boundary. */
export function parseProfilePage(value: unknown, viewerId: string, origin: string): ProfilePage {
  return readProfilePage(value, viewerId, viewerId, origin);
}

export function parsePublicProfilePage(value: unknown, expectedId: string, viewerId: string, origin: string): ProfilePage {
  if (!validId(expectedId)) throw new ApiError("Profile not found.", 404);
  return readProfilePage(value, expectedId.toLowerCase(), viewerId, origin);
}

export function contributorDestination(id: string) {
  if (!validId(id)) throw new ApiError("Profile not found.", 404);
  return { pathname: "/citizen" as const, params: { profile: id } };
}

export function profilePhotoError(photo: ProfilePhoto): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(photo.mimeType))
    return "Choose a JPEG, PNG, or WebP photo.";
  if (!Number.isFinite(photo.size) || photo.size <= 0 || !photo.uri)
    return "This photo could not be read. Choose it again.";
  if (photo.size > PROFILE_PHOTO_LIMIT) return "Each profile photo must be 4 MB or less.";
  return null;
}

export function profileChangesError(changes: ProfileChanges): string | null {
  const name = changes.name.trim();
  if (name.length < 2 || name.length > 80) return "Use a name between 2 and 80 characters.";
  if (changes.governmentProfile) {
    const { level, jurisdiction, bio } = changes.governmentProfile;
    if (!["MUNICIPAL", "BARANGAY"].includes(level) || jurisdiction.trim().length < 2 || jurisdiction.trim().length > 120)
      return "Choose an office level and enter a jurisdiction between 2 and 120 characters.";
    if (bio.trim().length > 500) return "Keep your office description under 500 characters.";
  }
  for (const kind of ["avatar", "cover"] as const) {
    const photo = changes[kind];
    if (photo && !(kind === "avatar" ? changes.removeAvatar : changes.removeCover)) {
      const error = profilePhotoError(photo);
      if (error) return error;
    }
  }
  return null;
}

export function parseSavedProfile(value: unknown, expectedId: string, origin: string) {
  if (!isRecord(value) || !isRecord(value.profile) || value.profile.id !== expectedId ||
      typeof value.profile.name !== "string" || !value.profile.name.trim())
    throw new ApiError("The server did not confirm your profile changes. Refresh your profile before trying again.");
  return { id: expectedId, name: value.profile.name,
    avatarUrl: profileImageUrl(value.profile.avatarUrl, origin), coverUrl: profileImageUrl(value.profile.coverUrl, origin) };
}
