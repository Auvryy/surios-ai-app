import * as ImagePicker from "expo-image-picker";
import { File as NativeFile } from "expo-file-system";
import { Platform } from "react-native";
import { ApiError } from "./api-client";
import { validId } from "./discussion";
import type { ProfilePhoto } from "./profile";
export const REPOST_PHOTO_LIMIT = 5 * 1024 * 1024;
export function repostPhotoError(photo: ProfilePhoto): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(photo.mimeType))
    return "Use one JPEG, PNG, or WebP image.";
  if (!Number.isFinite(photo.size) || photo.size <= 0)
    return "The image could not be read. Choose it again.";
  return photo.size > REPOST_PHOTO_LIMIT
    ? "The repost image must be 5 MB or less."
    : null;
}
export async function chooseRepostPhoto(): Promise<ProfilePhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    quality: 1,
  });
  if (result.canceled) return null;
  const a = result.assets[0];
  if (!a) throw new ApiError("Choose an image to continue.");
  const mimeType = a.mimeType || a.file?.type || "";
  const photo: ProfilePhoto = {
    uri: a.uri,
    name:
      a.fileName ||
      `repost.${mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg"}`,
    mimeType,
    file: a.file,
    size:
      a.fileSize ??
      a.file?.size ??
      (Platform.OS === "web" ? 0 : new NativeFile(a.uri).size),
  };
  const error = repostPhotoError(photo);
  if (error) {
    if (Platform.OS === "web" && photo.uri.startsWith("blob:"))
      URL.revokeObjectURL(photo.uri);
    throw new ApiError(error);
  }
  return photo;
}
export function repostForm(
  id: string,
  postId: string,
  quoteId: string | null,
  body: string,
  photo: ProfilePhoto | null,
) {
  if (
    !validId(id) ||
    !validId(postId) ||
    (quoteId != null && !validId(quoteId)) ||
    body.trim().length > 1000
  )
    throw new ApiError("Choose a post and write up to 1,000 characters.");
  const form = new FormData();
  form.append("id", id);
  form.append("postId", postId);
  form.append("body", body.trim());
  if (quoteId) form.append("quotedRepostId", quoteId);
  if (photo) {
    const error = repostPhotoError(photo);
    if (error) throw new ApiError(error);
    if (Platform.OS === "web") {
      if (!photo.file) throw new ApiError("Choose this image again.");
      form.append("image", photo.file, photo.name);
    } else
      form.append("image", {
        uri: photo.uri,
        name: photo.name,
        type: photo.mimeType,
      } as unknown as Blob);
  }
  return form;
}
