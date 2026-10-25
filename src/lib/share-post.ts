import { Platform, Share } from "react-native";
export async function sharePost(
  title: string,
  url: string,
): Promise<"shared" | "cancelled" | "manual"> {
  const result = await Share.share(
    Platform.OS === "ios"
      ? { title, message: title, url }
      : { title, message: `${title}\n${url}` },
  );
  return result.action === Share.dismissedAction ? "cancelled" : "shared";
}
export async function copyPostLink(_url: string): Promise<boolean> {
  return false;
}
