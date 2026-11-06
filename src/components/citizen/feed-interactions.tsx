import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { apiOrigin } from "@/auth/api";
import { useSession } from "@/auth/session-provider";
import { useTheme } from "@/constants/theme";
import { Button, Field, Notice, ui } from "@/components/ui/controls";
import { commentError, confirmComment, confirmReaction, parseThread, type Thread, type Comment } from "@/lib/discussion";
import type { FeedCard } from "@/lib/feed";

export function FeedInteractions({ item, onOpen }: { item: FeedCard; onOpen: () => void }) {
  const { request } = useSession();
  const { colors } = useTheme();
  const [thread, setThread] = useState<Thread | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const readVersion = useRef(0);
  const live = useRef(false);
  const locked = useRef(false);
  const path = `/api/community/${item.repost ? `reposts/${item.recordId}` : `posts/${item.postId}`}`;
  const load = useCallback(async (signal?: AbortSignal) => {
    const version = ++readVersion.current;
    const result = parseThread(await request(`/api/community/posts/${item.postId}`, { signal }), item.postId, apiOrigin());
    if (live.current && !signal?.aborted && version === readVersion.current) { setThread(result); setUncertain(false); }
  }, [item.postId, request]);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useFocusEffect(useCallback(() => {
    if (locked.current) return;
    const controller = new AbortController();
    void load(controller.signal).catch(() => { if (live.current && !controller.signal.aborted) setError("Could not load reactions. Retry to refresh."); });
    return () => controller.abort();
  }, [load]));
  const quote = item.repost ? thread?.reposts.find((r) => r.id === item.recordId) : null;
  const target = item.repost ? quote : thread?.post;
  const comments = target?.comments || [];
  const liked = quote ? quote.userLiked : thread?.post.userConfirmed || false;
  const likes = quote ? quote.likes : thread?.post.confirmations || 0;
  const mutate = async (action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; ++readVersion.current; setBusy(true); setError("");
    try { await action(); await load(); }
    catch (cause) { if (live.current) setError(cause instanceof Error ? cause.message : "Could not save. Please refresh before retrying."); }
    finally { locked.current = false; if (live.current) setBusy(false); }
  };
  const like = () => void mutate(async () => {
    const result = confirmReaction(await request(path, { method: "POST", body: { action: "like", liked: !liked } }), !liked, !item.repost);
    if (live.current) setThread((current) => current ? item.repost ? { ...current, reposts: current.reposts.map((r) => r.id === item.recordId ? { ...r, ...result } : r) } : { ...current, post: { ...current.post, confirmations: result.likes, userConfirmed: result.userLiked } } : current);
  });
  const send = () => {
    if (uncertain) return;
    const issue = commentError(body); if (issue) { setError(issue); return; }
    void mutate(async () => {
      if (live.current) setUncertain(true);
      confirmComment(await request(path, { method: "POST", body: { action: "comment", body: body.trim(), parentId: null } }), !item.repost);
      if (live.current) { setBody(""); setUncertain(false); }
    });
  };
  const likeComment = (comment: Comment) => void mutate(async () => {
    await request(item.repost ? `/api/community/reposts/${item.recordId}/comments/${comment.id}` : `/api/community/comments/${comment.id}`, { method: "POST", body: { liked: !comment.userLiked } });
  });
  return <View pointerEvents="box-none" style={ui.gap}>
    <View pointerEvents="box-none" style={ui.row}>
      <Button label={target ? `${liked ? "Liked" : "Like"} · ${likes}` : "Like"} icon="heart" disabled={busy || !target} onPress={like} />
      <Button label={target ? `Comments · ${comments.length}` : "Comments"} icon="message-circle" disabled={busy} onPress={() => setExpanded((v) => !v)} />
    </View>
    {!expanded && comments.length > 0 && <Text numberOfLines={2} style={[ui.body, { color: colors.text }]}>{comments[0].author.name}: {comments[0].body}</Text>}
    {!!error && <Notice error>{error}{uncertain ? " Refresh the discussion to check whether your comment was saved before sending again." : ""}</Notice>}
    {!!error && <Button label="Refresh reactions" disabled={busy} onPress={() => void mutate(async () => {})} />}
    {expanded && <View pointerEvents="box-none" style={ui.gap}>
      {comments.length === 0 && <Text style={[ui.caption, { color: colors.muted }]}>No comments yet.</Text>}
      {comments.slice(-3).map((comment) => <View key={comment.id} style={ui.gap}>
        <Text style={[ui.label, { color: colors.text }]}>{comment.author.name}</Text>
        <Text style={[ui.body, { color: colors.text }]}>{comment.body}</Text>
        <Button label={`${comment.userLiked ? "Liked" : "Like comment"} · ${comment.likes}`} disabled={busy} onPress={() => likeComment(comment)} />
      </View>)}
      <Field label="Write a comment" value={body} onChangeText={setBody} editable={!busy} multiline maxLength={1000} />
      <Button label={busy ? "Saving…" : "Send comment"} disabled={busy || uncertain || !target || !body.trim()} onPress={send} />
      <Button label="View full discussion and replies" onPress={onOpen} />
    </View>}
  </View>;
}
