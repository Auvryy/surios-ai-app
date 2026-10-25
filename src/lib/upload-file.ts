import { File as NativeFile } from "expo-file-system";
import { Platform } from "react-native";
import { ApiError } from "./api-client";

type Upload = { uri: string; name: string; file?: File };

export function appendUpload(form: FormData, field: string, upload: Upload) {
  if (Platform.OS === "web") {
    if (!upload.file)
      throw new ApiError("The selected file is no longer available. Choose it again.");
    form.append(field, upload.file, upload.name);
  } else {
    const file = new NativeFile(upload.uri);
    if (!file.exists || !file.size)
      throw new ApiError("The selected file is no longer available. Choose it again.");
    // SDK 58 uses Expo fetch. Its multipart encoder reads File.bytes();
    // legacy React Native { uri, name, type } parts fail before any HTTP request.
    form.append(field, file);
  }
}
