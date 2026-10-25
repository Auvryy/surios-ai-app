import { isRecord } from "../auth/contracts";
import { ApiError } from "./api-client";
import { validId } from "./discussion";

export type DeleteTarget = {
  id: string;
  kind: "post" | "repost";
  authorId: string | null;
  official: boolean;
  deleted: boolean;
};

export function canDeletePost(target: DeleteTarget, userId: string | undefined): boolean {
  return (target.kind === "post" || target.kind === "repost") && validId(target.id) && validId(userId) && target.authorId === userId &&
    !target.official && !target.deleted;
}

export function deletionRequest(target: DeleteTarget, userId: string | undefined): string {
  if (!canDeletePost(target, userId)) throw new ApiError("You can only delete your own posts and social reposts.", 403);
  return target.kind === "repost" ? `/api/community/reposts?id=${encodeURIComponent(target.id)}` :
    `/api/community/posts/${encodeURIComponent(target.id)}`;
}

export function confirmDeletion(value: unknown, kind: DeleteTarget["kind"]): void {
  if (!isRecord(value) || (kind === "post" ? value.deleted !== true || value.retainedHazard !== true : value.removed !== true))
    throw new ApiError("The server did not confirm deletion. Refresh the post before trying again.");
}
