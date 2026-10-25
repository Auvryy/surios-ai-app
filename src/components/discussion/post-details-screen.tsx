import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { apiOrigin } from "@/auth/api";
import { isRecord } from "@/auth/contracts";
import { useSession } from "@/auth/session-provider";
import { Avatar } from "@/components/ui/avatar";
import {
  Button,
  Field,
  IconButton,
  Notice,
  Sheet,
  ui,
} from "@/components/ui/controls";
import { useTheme } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import {
  commentError,
  confirmComment,
  confirmReaction,
  parseThread,
  postPath,
  type Comment,
  type Repost,
  type Thread,
} from "@/lib/discussion";
import { publicUrl } from "@/lib/feed";
import { contributorDestination, profileImageUrl } from "@/lib/profile";
import { PostMenu } from "@/components/citizen/post-menu";
import { AuthorLine, PostContent } from "./post-content";
import { RepostComposer } from "./repost-composer";
import { ShareSheet } from "./share-sheet";
const likeLabel = (count: number) =>
  `${count} ${count === 1 ? "like" : "likes"}`;

type Row =
  | { kind: "comment"; value: Comment }
  | { kind: "repost"; value: Repost }
  | { kind: "heading" };

export function PostDetailsScreen({
  id,
  repostId,
  onBack,
}: {
  id: string;
  repostId: string | null;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const { request } = useSession();
  const router = useRouter();
  const [data, setData] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [commentOpen, setCommentOpen] = useState(false);
  const [reply, setReply] = useState<Comment | null>(null);
  const [body, setBody] = useState("");
  const [commentIssue, setCommentIssue] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const mounted = useRef(false),
    updating = useRef(false),
    pending = useRef<AbortController | null>(null);
  const quote = repostId
    ? data?.reposts.find((r) => r.id === repostId) || null
    : null;
  const post = quote?.post || data?.post;
  const discussion = quote?.comments || post?.comments || [];
  const related = data?.reposts.filter((r) => r.id !== quote?.id) || [];
  const rows: Row[] = post
    ? [
        ...discussion.map((value) => ({ kind: "comment" as const, value })),
        { kind: "heading" },
        ...related.map((value) => ({ kind: "repost" as const, value })),
      ]
    : [];
  const path = `/api/community/${repostId ? `reposts/${repostId}` : `posts/${id}`}`;
  const load = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError("");
    try {
      const result = parseThread(
        await request(`/api/community/posts/${id}`, {
          signal: controller.signal,
        }),
        id,
        apiOrigin(),
      );
      if (repostId && !result.reposts.some((r) => r.id === repostId))
        throw new ApiError("This repost is no longer available.", 404);
      if (!controller.signal.aborted && mounted.current) {
        setData(result);
        setUncertain(false);
      }
      return !controller.signal.aborted;
    } catch (cause) {
      if (!controller.signal.aborted && mounted.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "This post could not be loaded.",
        );
        if (cause instanceof ApiError && cause.status === 404) setData(null);
      }
      return false;
    } finally {
      if (!controller.signal.aborted && mounted.current) setLoading(false);
    }
  }, [id, repostId, request]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current?.abort();
    };
  }, []);
  useFocusEffect(
    useCallback(() => {
      if (!updating.current) void load();
      return () => pending.current?.abort();
    }, [load]),
  );
  const mutate = async (action: () => Promise<void>) => {
    if (updating.current) return;
    updating.current = true;
    pending.current?.abort();
    setLoading(false);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      if (mounted.current) await load();
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Your change could not be saved. Please try again.",
        );
    } finally {
      updating.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const likePost = () =>
    void mutate(async () => {
      if (!data || !post) return;
      const liked = !(quote ? quote.userLiked : post.userConfirmed);
      const saved = confirmReaction(
        await request(path, {
          method: "POST",
          body: { action: "like", liked },
        }),
        liked,
        !quote,
      );
      if (mounted.current) {
        setData((previous) =>
          previous
            ? quote
              ? {
                  ...previous,
                  reposts: previous.reposts.map((r) =>
                    r.id === quote.id
                      ? { ...r, likes: saved.likes, userLiked: saved.userLiked }
                      : r,
                  ),
                }
              : {
                  ...previous,
                  post: {
                    ...previous.post,
                    confirmations: saved.likes,
                    userConfirmed: saved.userLiked,
                  },
                }
            : previous,
        );
        setMessage(liked ? "Like saved." : "Like removed.");
      }
    });
  const likeComment = (comment: Comment) =>
    void mutate(async () => {
      const liked = !comment.userLiked;
      const result = await request(
        quote
          ? `/api/community/reposts/${quote.id}/comments/${comment.id}`
          : `/api/community/comments/${comment.id}`,
        { method: "POST", body: { liked } },
      );
      if (
        !isRecord(result) ||
        result.userLiked !== liked ||
        (!quote &&
          (!Number.isSafeInteger(result.likes) || Number(result.likes) < 0))
      )
        throw new ApiError(
          "The comment reaction was not confirmed. Refresh before trying again.",
        );
      if (mounted.current)
        setMessage(liked ? "Comment like saved." : "Comment like removed.");
    });
  const send = async () => {
    if (updating.current || uncertain) return;
    const validation = commentError(body);
    if (validation) {
      setCommentIssue(validation);
      return;
    }
    updating.current = true;
    pending.current?.abort();
    setLoading(false);
    setBusy(true);
    setCommentIssue("");
    setError("");
    setMessage("");
    let acknowledged = false;
    try {
      const result = await request(path, {
        method: "POST",
        body: {
          action: "comment",
          body: body.trim(),
          parentId: reply?.id || null,
        },
      });
      confirmComment(result, !quote);
      acknowledged = true;
      if (mounted.current) {
        setBody("");
        setReply(null);
        setCommentOpen(false);
        setMessage("Comment posted.");
        await load();
      }
    } catch (cause) {
      if (mounted.current) {
        setCommentIssue(
          cause instanceof Error
            ? cause.message
            : "The comment could not be saved.",
        );
        if (
          !acknowledged &&
          (!(cause instanceof ApiError) ||
            cause.status === 0 ||
            cause.status >= 500)
        )
          setUncertain(true);
      }
    } finally {
      updating.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const openComment = (target: Comment | null) => {
    setReply(target);
    setCommentIssue("");
    setCommentOpen(true);
  };
  const open = (postId: string, quoteId: string) =>
    router.push({
      pathname: "/post/[id]",
      params: { id: postId, repost: quoteId },
    });
  const card = { borderColor: colors.border, backgroundColor: colors.surface };
  return (
    <View style={styles.screen}>
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <IconButton label="Back" icon="arrow-left" onPress={onBack} />
        <Text
          accessibilityRole="header"
          style={[ui.heading, styles.flex, { color: colors.text }]}
        >
          {quote?.governmentUpdate
            ? "Government update"
            : repostId
              ? "Repost"
              : "Post"}
        </Text>
        <IconButton
          label="Refresh discussion"
          icon="refresh-cw"
          disabled={busy || loading || reposting}
          onPress={() => void load()}
        />
      </View>
      <FlatList<Row>
        data={rows}
        keyExtractor={(r) =>
          r.kind === "heading" ? "related-heading" : `${r.kind}:${r.value.id}`
        }
        style={styles.flex}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshing={loading && !!data}
        onRefresh={() => {
          if (!updating.current && !reposting) void load();
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            {loading && (
              <ActivityIndicator
                accessibilityLabel="Loading discussion"
                color={colors.primary}
              />
            )}
            {!!error && (
              <>
                <Notice error>{error}</Notice>
                <Button
                  label="Retry loading post"
                  disabled={busy || loading}
                  onPress={() => void load()}
                />
              </>
            )}
            {!!message && (
              <Text
                accessibilityRole="status"
                accessibilityLiveRegion="polite"
                style={[ui.body, { color: colors.primary }]}
              >
                {message}
              </Text>
            )}
            {post && (
              <>
                <View style={[ui.card, card]}>
                  <View style={{ alignItems: "flex-end" }}><PostMenu
                    target={{ id: quote?.id || post.id, kind: quote ? "repost" : "post", authorId: (quote?.author || post.author).id, official: !!quote?.governmentUpdate, deleted: !quote && post.deleted }}
                    disabled={busy || loading}
                    onBusyChange={(next) => { updating.current = next; if (next) { pending.current?.abort(); setLoading(false); } setBusy(next); }}
                    onDeleted={() => {
                      if (quote) {
                        setData((current) => current ? { ...current, reposts: current.reposts.filter((item) => item.id !== quote.id) } : current);
                        router.replace({ pathname: "/post/[id]", params: { id: post.id } });
                      } else {
                        // The DELETE receipt is authoritative even if the follow-up read fails.
                        const retained = (item: Thread["post"]) => item.id === post.id ? { ...item, title: "Post deleted by author", body: "", media: [], deleted: true } : item;
                        setData((current) => current ? { ...current, post: retained(current.post), reposts: current.reposts.map((item) => ({ ...item, post: retained(item.post) })) } : current);
                        setMessage("Your post was deleted. Its linked hazard and official updates remain available."); void load();
                      }
                    }} /></View>
                  <PostContent
                    key={`${post.id}:${quote?.id || "post"}`}
                    post={post}
                    quote={quote}
                  />
                  <View style={ui.row}>
                    <Button
                      label={likeLabel(
                        quote ? quote.likes : post.confirmations,
                      )}
                      accessibilityLabel={
                        quote?.userLiked || (!quote && post.userConfirmed)
                          ? "Unlike post"
                          : "Like post"
                      }
                      selected={
                        quote?.userLiked || (!quote && post.userConfirmed)
                      }
                      icon="heart"
                      disabled={busy || loading || (!quote && post.deleted)}
                      onPress={likePost}
                    />
                    <Button
                      label={`Repost (${quote ? quote.reposts : post.reposts})`}
                      accessibilityLabel="Repost"
                      icon="repeat"
                      disabled={busy || loading || post.deleted}
                      onPress={() => setReposting(true)}
                    />
                    <Button
                      label="Share"
                      icon="share-2"
                      disabled={busy}
                      onPress={() => setSharing(true)}
                    />
                  </View>
                </View>
                <View style={styles.commentHeading}>
                  <Text
                    accessibilityRole="header"
                    style={[ui.heading, { color: colors.text }]}
                  >
                    Comments ({discussion.length})
                  </Text>
                  <Button
                    label="Add comment"
                    icon="message-circle"
                    disabled={busy || loading || (!quote && post.deleted)}
                    onPress={() => openComment(null)}
                  />
                </View>
                {!discussion.length && !loading && (
                  <Text
                    style={[ui.body, styles.empty, { color: colors.muted }]}
                  >
                    No comments yet. Start the conversation.
                  </Text>
                )}
              </>
            )}
          </View>
        }
        renderItem={({ item: row }) => {
          if (row.kind === "heading")
            return (
              <View style={styles.related}>
                <Text
                  accessibilityRole="header"
                  style={[ui.heading, { color: colors.text }]}
                >
                  {quote ? "Other updates" : "Reposts and government updates"}
                </Text>
                {!related.length && (
                  <Text style={[ui.body, { color: colors.muted }]}>
                    No other updates yet.
                  </Text>
                )}
              </View>
            );
          if (row.kind === "repost") {
            const r = row.value;
            return (
              <View style={[ui.card, styles.relatedCard, card]}>
                <AuthorLine
                  author={r.author}
                  createdAt={r.createdAt}
                  label={r.governmentUpdate ? "Government update" : "Repost"}
                />
                <Text
                  numberOfLines={3}
                  style={[ui.body, { color: colors.text }]}
                >
                  {r.body || r.post.title}
                </Text>
                <Button
                  label={
                    r.governmentUpdate
                      ? "Open government update"
                      : "Open repost"
                  }
                  onPress={() => open(r.post.id, r.id)}
                />
              </View>
            );
          }
          const item = row.value;
          return (
            <View style={[styles.comment, item.parentId && styles.reply, card]}>
              <Pressable accessibilityRole="link" accessibilityLabel={`View profile of ${item.author.name}`}
                onPress={() => router.push(contributorDestination(item.author.id))} style={{ minHeight: 48, minWidth: 48, justifyContent: "center" }}><Avatar
                name={item.author.name}
                uri={profileImageUrl(item.author.avatarUrl, apiOrigin())}
                size={32}
              /></Pressable>
              <View style={[styles.flex, ui.group]}>
                <Pressable accessibilityRole="link" accessibilityLabel={`View profile of ${item.author.name}`}
                  onPress={() => router.push(contributorDestination(item.author.id))} style={{ minHeight: 48, justifyContent: "center" }}><Text style={[ui.label, { color: colors.text }]}>
                  {item.author.name}
                </Text></Pressable>
                {item.parentId && (
                  <Text style={[ui.caption, { color: colors.muted }]}>
                    Replying to{" "}
                    {discussion.find((c) => c.id === item.parentId)?.author
                      .name || "a comment"}
                  </Text>
                )}
                <Text selectable style={[ui.body, { color: colors.text }]}>
                  {item.body}
                </Text>
                <Text style={[ui.caption, { color: colors.muted }]}>
                  {new Date(item.createdAt).toLocaleString("en-PH")}
                </Text>
                <View style={ui.row}>
                  <Button
                    label={likeLabel(item.likes)}
                    accessibilityLabel={`${item.userLiked ? "Unlike" : "Like"} comment by ${item.author.name}`}
                    icon="heart"
                    selected={item.userLiked}
                    disabled={busy || loading}
                    onPress={() => likeComment(item)}
                  />
                  <Button
                    label="Reply"
                    accessibilityLabel={`Reply to ${item.author.name}`}
                    disabled={busy || loading || (!quote && post?.deleted)}
                    onPress={() => openComment(item)}
                  />
                </View>
              </View>
            </View>
          );
        }}
      />
      {post && reposting && (
        <RepostComposer
          post={post}
          quote={quote}
          onClose={() => setReposting(false)}
          onSaved={() => {
            setReposting(false);
            setMessage("Repost published.");
            void load();
          }}
        />
      )}
      {post && sharing && (
        <ShareSheet
          title={
            quote?.governmentUpdate
              ? `Government update: ${post.title}`
              : post.title
          }
          url={publicUrl(postPath(post.id, quote?.id), apiOrigin())}
          onClose={() => setSharing(false)}
        />
      )}
      {commentOpen && (
        <Sheet
          title={reply ? "Write reply" : "Write comment"}
          subtitle={
            reply
              ? `Replying to ${reply.author.name}`
              : quote
                ? "Comment on this update"
                : "Comment on this report"
          }
          onClose={() => setCommentOpen(false)}
          closeDisabled={busy}
        >
          {reply && (
            <>
              <Text
                numberOfLines={3}
                style={[ui.body, { color: colors.muted }]}
              >
                {reply.body}
              </Text>
              <Button
                label="Cancel reply"
                disabled={busy}
                onPress={() => setReply(null)}
              />
            </>
          )}
          <Field
            label={reply ? "Your reply" : "Your comment"}
            value={body}
            onChangeText={setBody}
            placeholder={reply ? "Write a reply…" : "Write a comment…"}
            multiline
            maxLength={1000}
            editable={!busy && !uncertain}
            autoFocus
          />
          <Text style={[ui.caption, { color: colors.muted }]}>
            {body.length}/1,000
          </Text>
          {!!commentIssue && <Notice error>{commentIssue}</Notice>}
          {uncertain && (
            <>
              <Notice>
                The response was interrupted. Check the discussion before
                sending again so your comment is not duplicated.
              </Notice>
              <Button
                label="Check discussion"
                disabled={busy || loading}
                onPress={() => {
                  void load().then((ok) => {
                    if (!mounted.current) return;
                    if (ok) {
                      setCommentIssue("");
                      setCommentOpen(false);
                    } else
                      setCommentIssue(
                        "The discussion could not refresh. Please check your connection and try again.",
                      );
                  });
                }}
              />
            </>
          )}
          <Button
            label={reply ? "Send reply" : "Send comment"}
            icon="send"
            variant="primary"
            busy={busy}
            disabled={uncertain || !body.trim()}
            onPress={() => void send()}
          />
        </Sheet>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
  },
  list: { padding: 16, paddingBottom: 32 },
  header: { gap: 16 },
  commentHeading: { gap: 10, marginTop: 8 },
  comment: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 8,
    flexDirection: "row",
  },
  reply: { marginLeft: 20 },
  empty: { paddingVertical: 16 },
  related: { marginTop: 20, marginBottom: 14, gap: 14 },
  relatedCard: { marginBottom: 14 },
});
