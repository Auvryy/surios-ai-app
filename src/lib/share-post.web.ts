export async function sharePost(
  title: string,
  url: string,
): Promise<"shared" | "cancelled" | "manual"> {
  if (typeof navigator.share !== "function") return "manual";
  try {
    await navigator.share({ title, url });
    return "shared";
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError")
      return "cancelled";
    throw cause;
  }
}
export async function copyPostLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
