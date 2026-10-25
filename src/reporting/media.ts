import * as ImagePicker from "expo-image-picker";
import { randomUUID } from "expo-crypto";
import { File as NativeFile } from "expo-file-system";
import { Platform } from "react-native";
import { ApiError } from "../lib/api-client";
import { appendUpload } from "../lib/upload-file";
import type { Attachment } from "./contracts";

export async function chooseEvidence(camera: boolean): Promise<Attachment[]> {
  if (camera && Platform.OS !== "web") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted)
      throw new ApiError(
        "Camera access is unavailable. Allow it in Settings or choose evidence from your library.",
      );
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: camera ? ["images"] : ["images", "videos"],
    quality: 0.85,
    allowsMultipleSelection: !camera,
    selectionLimit: 6,
    allowsEditing: false,
  };
  // Call the browser picker directly from the press event (no permission await on web).
  const result = camera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return [];
  return result.assets.map((asset) => {
    const size =
      asset.fileSize ??
      asset.file?.size ??
      (Platform.OS !== "web" ? new NativeFile(asset.uri).size : 0);
    return {
      id: randomUUID(),
      uri: asset.uri,
      name:
        asset.fileName ||
        `evidence-${Date.now()}.${asset.type === "video" ? "mp4" : "jpg"}`,
      mimeType: asset.mimeType || asset.file?.type || "",
      size,
      file: asset.file,
    };
  });
}
export function assessmentForm(
  files: Attachment[],
  title: string,
  body: string,
) {
  const form = new FormData();
  for (const file of files) {
    appendUpload(form, "media", file);
  }
  form.append("headline", title);
  form.append("caption", body);
  return form;
}
