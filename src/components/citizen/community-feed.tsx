import Feather from "@expo/vector-icons/Feather";
import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { apiOrigin } from "@/auth/api";
import { useSession } from "@/auth/session-provider";
import { useTheme } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import {
  parseFeedPage,
  publicUrl,
  type FeedCard,
  type FeedPage,
} from "@/lib/feed";
import { Button } from "@/components/ui/controls";
import { Avatar } from "@/components/ui/avatar";
import { contributorDestination, profileImageUrl } from "@/lib/profile";
import { postDestination, validId } from "@/lib/discussion";
import { PostGallery } from "./post-gallery";
import { feedRequest, type FeedQuery } from "@/lib/feed-filters";
import { FeedControls } from "./feed-controls";
import { PostMenu } from "./post-menu";

export function CommunityFeed({
  header,
  composer,
  onMap,
  query,
  onQueryChange,
}: {
  header: ReactNode;
  composer?: ReactNode;
  onMap: (id?: string) => void;
  query: FeedQuery;
  onQueryChange: (query: FeedQuery) => void;
}) {
  const { colors } = useTheme();
  const { request } = useSession();
  const [result, setResult] = useState<{ key: string; page: FeedPage } | null>(null);
  const key = feedRequest(query);
  const data = result?.key === key ? result.page : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const lastPage = useRef(1);
  const fetchPage = useCallback(
    (page: number) => {
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      lastPage.current = page;
      setLoading(true);
      setError(null);
      return request(feedRequest(query, page), {
        signal: controller.signal,
      })
        .then((response) => {
          const result = parseFeedPage(response);
          // The API returns cumulative pages. Replace the collection rather than append duplicates.
          if (!controller.signal.aborted) {
            setResult({ key, page: result });
            setError(null);
          }
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted)
            setError(
              cause instanceof ApiError
                ? cause.message
                : "Reports could not be loaded. Please try again.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    },
    [request, query, key],
  );
  useFocusEffect(useCallback(() => {
    void fetchPage(1);
    return () => pending.current?.abort();
  }, [fetchPage]));
  const load = (page: number) => {
    setLoading(true);
    setError(null);
    void fetchPage(page);
  };

  return (
    <FlatList
      data={data?.feed || []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<View style={styles.header}>{header}
        {!query.q && query.tab !== "liked" && composer}
        <FeedControls key={`${query.tab}:${query.q}`} query={query} onChange={onQueryChange} total={data?.total ?? null} loading={loading} />
      </View>}
      renderItem={({ item }) => <PostCard item={item} onMap={onMap} onDeleted={() => load(lastPage.current)} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      refreshing={loading && !!data}
      onRefresh={() => void load(1)}
      ListEmptyComponent={
        !loading && !error ? (
          <View
            style={[
              styles.empty,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Feather name="message-circle" size={28} color={colors.primary} />
            <Text style={[styles.title, { color: colors.text }]}>
              {query.tab === "liked" ? "No liked posts found" : query.q || query.tab !== "all" || query.media !== "all" ? "No matching updates" : "No reports yet"}
            </Text>
            <Text style={[styles.body, { color: colors.muted }]}>
              {query.tab === "liked" ? "Posts and official updates you like will appear here. Try another search or browse the community feed." : query.q || query.tab !== "all" || query.media !== "all" ? "Try a different name, place, or filter." : "Saved community reports and official updates will appear here."}
            </Text>
          </View>
        ) : undefined
      }
      ListFooterComponent={
        <View style={styles.footer}>
          {loading && (
            <ActivityIndicator
              color={colors.primary}
              accessibilityLabel="Loading community reports"
            />
          )}
          {error && (
            <>
              <Text
                accessibilityRole="alert"
                style={[styles.body, { color: colors.error }]}
              >
                {error}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void load(lastPage.current)}
                style={[styles.button, { backgroundColor: colors.accent }]}
              >
                <Text style={[styles.buttonText, { color: colors.primary }]}>
                  Retry loading reports
                </Text>
              </Pressable>
            </>
          )}
          {data?.hasMore && !error && (
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              accessibilityState={{ disabled: loading, busy: loading }}
              onPress={() => void load(data.currentPage + 1)}
              style={({ pressed }) => [
                styles.button,
                {
                  borderColor: colors.border,
                  borderWidth: 1,
                  opacity: pressed || loading ? 0.65 : 1,
                },
              ]}
            >
              <Text style={[styles.buttonText, { color: colors.primary }]}>
                Load more reports
              </Text>
            </Pressable>
          )}
          <Text style={[styles.note, { color: colors.muted }]}>
            Open a report to view its full discussion, evidence and official updates.
          </Text>
        </View>
      }
    />
  );
}

export function PostCard({
  item,
  onMap,
  onDeleted,
}: {
  item: FeedCard;
  onMap: (id?: string) => void;
  onDeleted?: () => void;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const [linkError, setLinkError] = useState("");
  const [removed, setRemoved] = useState(false);
  const open = async (path: string) => {
    try {
      setLinkError("");
      const target = postDestination(path, apiOrigin());
      if (target) { router.push(target); return; }
      await Linking.openURL(publicUrl(path, apiOrigin()));
    } catch {
      setLinkError("Could not open this post. Please try again.");
    }
  };
  const resolved = item.status === "RESOLVED";
  const status = resolved
    ? "Resolved"
    : item.status === "IN_REPAIR"
      ? "In progress"
      : "Reported";
  if (removed) return null;
  return (
    <View
      style={[
        styles.card,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={styles.authorRow}>
        <Pressable accessibilityRole="link" accessibilityLabel={`View profile of ${item.author}`}
          disabled={!validId(item.authorId)} onPress={() => { if (item.authorId) router.push(contributorDestination(item.authorId)); }}
          style={({ pressed }) => [{ flex: 1, minWidth: 0, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.7 : 1 }]}>
        <Avatar name={item.author} uri={profileImageUrl(item.authorAvatarUrl, apiOrigin())} size={42} />
        <View style={styles.authorCopy}>
          <Text style={[styles.author, { color: colors.text }]}>
            {item.author}
          </Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            {item.official
              ? "Government update · "
              : item.repost
                ? "Repost · "
                : ""}
            {new Date(item.createdAt).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
        </View>
        </Pressable>
        <PostMenu target={{ id: item.recordId, kind: item.repost ? "repost" : "post", authorId: item.authorId, official: item.official, deleted: item.deleted }}
          onDeleted={() => { setRemoved(true); onDeleted?.(); }} />
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${status}${resolved && item.resolutionUrl ? ": view official explanation" : ": open report"}`}
        onPress={() =>
          void open(
            resolved && item.resolutionUrl ? item.resolutionUrl : item.url,
          )
        }
        style={({ pressed }) => [
          styles.status,
          {
            backgroundColor: resolved
              ? colors.successBackground
              : colors.accent,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Feather
          name={resolved ? "check-circle" : "info"}
          size={15}
          color={resolved ? colors.success : colors.primary}
        />
        <Text
          style={[
            styles.meta,
            {
              color: resolved ? colors.success : colors.primary,
              fontWeight: "700",
            },
          ]}
        >
          {status}
        </Text>
      </Pressable>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: colors.text }]}
      >
        {item.title}
      </Text>
      {!!item.body && (
        <Text style={[styles.body, { color: colors.text }]} numberOfLines={5}>
          {item.body}
        </Text>
      )}
      <PostGallery key={`${item.id}:${item.coverId}`} media={item.media} coverId={item.coverId} point={item.point} roadSegment={item.roadSegment} title={item.title}
        onMap={item.reportId ? () => onMap(item.reportId!) : undefined} />
      {item.originalTitle && (
        <View style={[styles.quote, { borderColor: colors.border }]}>
          <Text style={[styles.meta, { color: colors.muted }]}>
            Original report
          </Text>
          <Text style={[styles.body, { color: colors.text }]}>
            {item.originalTitle}
          </Text>
        </View>
      )}
      {!!item.location && (
        <Text style={[styles.meta, { color: colors.muted }]}>
          {item.location}
        </Text>
      )}
      {item.reportId && (
        <Button
          label="View on hazard map"
          icon="map-pin"
          onPress={() => onMap(item.reportId!)}
        />
      )}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Open post"
        onPress={() => void open(item.url)}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.accent, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.buttonText, { color: colors.primary }]}>
          Open post
        </Text>
        <Feather
          name="arrow-right"
          accessible={false}
          aria-hidden
          size={17}
          color={colors.primary}
        />
      </Pressable>
      {!!linkError && (
        <Text
          accessibilityRole="alert"
          style={[styles.meta, { color: colors.error }]}
        >
          {linkError}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28 },
  header: { paddingBottom: 16, gap: 12 },
  separator: { height: 16 },
  card: { padding: 12, borderWidth: 1, borderRadius: 16, gap: 12 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  authorCopy: { flex: 1, gap: 2 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  author: { fontSize: 15, lineHeight: 22, fontWeight: "700" },
  meta: { fontSize: 12, lineHeight: 18 },
  title: { fontSize: 18, lineHeight: 25, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 23 },
  status: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    minHeight: 48,
    borderRadius: 24,
  },
  quote: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 5 },
  button: {
    minHeight: 48,
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  buttonText: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  footer: { paddingTop: 20, gap: 16 },
  note: { fontSize: 12, lineHeight: 18 },
  empty: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    gap: 12,
    alignItems: "center",
  },
});
