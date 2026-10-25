import * as ImagePicker from "expo-image-picker";
import { File as NativeFile } from "expo-file-system";
import { Platform } from "react-native";
import { ApiError } from "./api-client";
import { profileChangesError, profilePhotoError, type ProfileChanges, type ProfilePhoto } from "./profile";

export async function chooseProfilePhoto(): Promise<ProfilePhoto | null> {
  // Keep the picker directly in the press event so browser user activation is preserved.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"], allowsEditing: false, allowsMultipleSelection: false, quality: 1,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw new ApiError("Choose a photo to continue.");
  const mimeType = asset.mimeType || asset.file?.type || "";
  const photo: ProfilePhoto = {
    uri: asset.uri, name: asset.fileName || `profile.${mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg"}`,
    mimeType, file: asset.file,
    size: asset.fileSize ?? asset.file?.size ?? (Platform.OS !== "web" ? new NativeFile(asset.uri).size : 0),
  };
  const error = profilePhotoError(photo);
  if (error) { releaseProfilePhoto(photo); throw new ApiError(error); }
  return photo;
}

export function releaseProfilePhoto(photo: ProfilePhoto | null) {
  if (Platform.OS === "web" && photo?.uri.startsWith("blob:")) URL.revokeObjectURL(photo.uri);
}

export function profileForm(changes: ProfileChanges) {
  const error = profileChangesError(changes);
  if (error) throw new ApiError(error);
  const form = new FormData();
  form.append("name", changes.name.trim());
  form.append("removeAvatar", String(changes.removeAvatar));
  form.append("removeCover", String(changes.removeCover));
  if (changes.governmentProfile) {
    form.append("governmentLevel", changes.governmentProfile.level);
    form.append("jurisdiction", changes.governmentProfile.jurisdiction.trim());
    form.append("bio", changes.governmentProfile.bio.trim());
  }
  for (const kind of ["avatar", "cover"] as const) {
    const photo = changes[kind];
    if (!photo || (kind === "avatar" ? changes.removeAvatar : changes.removeCover)) continue;
    if (Platform.OS === "web") {
      if (!photo.file) throw new ApiError("This photo is no longer available. Choose it again.");
      form.append(kind, photo.file, photo.name);
    } else {
      form.append(kind, { uri: photo.uri, name: photo.name, type: photo.mimeType } as unknown as Blob);
    }
  }
  return form;
}
