import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "@/auth/session-provider";
import { Button, Notice, ui } from "@/components/ui/controls";
import { useTheme } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { notificationCopy, notificationDestination, parseNotifications, parseReadNotification, unreadLabel, type InboxNotification } from "@/lib/notifications";
import { useNotifications } from "./notification-provider";

export function NotificationInbox({ header }: { header: ReactElement }) {
  const { colors } = useTheme();
  const { request } = useSession();
  const { unreadCount, syncCount } = useNotifications();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const mounted = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const readingAll = useRef(false);
  const opened = useRef(new Set<string>());
  const filterRef = useRef(filter);
  useEffect(() => { filterRef.current = filter; }, [filter]);
  const load = useCallback((cursor: string | null = null) => {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setLoading(true); setError("");
    return request(`/api/notifications?filter=${filter}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { signal: controller.signal }).then((data) => {
      const result = parseNotifications(data);
      if (!mounted.current || controller.signal.aborted) return;
      setItems((previous) => cursor ? [...new Map([...previous, ...result.items].map((n) => [n.id, n])).values()] : result.items);
      setNextCursor(result.nextCursor); setLoaded(true); syncCount(result.unreadCount);
    }).catch((cause: unknown) => {
      if (mounted.current && !controller.signal.aborted) setError(cause instanceof ApiError && cause.status !== 404 ? cause.message : "Notifications are temporarily unavailable. Please try again.");
    }).finally(() => { if (mounted.current && !controller.signal.aborted) setLoading(false); if (pending.current === controller) pending.current = null; });
  }, [filter, request, syncCount]);
  useFocusEffect(useCallback(() => {
    mounted.current = true; void load();
    return () => { mounted.current = false; pending.current?.abort(); };
  }, [load]));

  const markAll = async () => {
    if (readingAll.current || loading || !unreadCount) return;
    readingAll.current = true; setReading(true); setError(""); setMessage("");
    try {
      const result = parseReadNotification(await request("/api/notifications", { method: "PATCH", body: { action: "read-all" } }));
      syncCount(result.unreadCount);
      if (mounted.current) {
        setItems((previous) => filterRef.current === "unread" ? [] : previous.map((n) => n.readAt ? n : { ...n, readAt: result.readAt }));
        if (filterRef.current === "unread") setNextCursor(null);
        setMessage("Notifications marked as read."); await load();
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof ApiError ? cause.message : "Your notifications could not be marked as read. Please try again.");
    } finally { readingAll.current = false; if (mounted.current) setReading(false); }
  };
  const open = (n: InboxNotification) => {
    if (opened.current.has(n.id) || readingAll.current) return;
    const destination = notificationDestination(n);
    if (!n.readAt) {
      opened.current.add(n.id);
      // A failed read receipt must not block access to the explanation/discussion.
      void request("/api/notifications", { method: "PATCH", body: { action: "read", id: n.id } }).then((data) => {
        const result = parseReadNotification(data); syncCount(result.unreadCount);
        if (mounted.current) setItems((previous) => filterRef.current === "unread" ? previous.filter((item) => item.id !== n.id) : previous.map((item) => item.id === n.id ? { ...item, readAt: result.readAt } : item));
      }).catch((cause) => {
        if (mounted.current) setError(cause instanceof ApiError ? `Could not mark as read: ${cause.message}` : "Could not mark this notification as read. Refresh to try again.");
      }).finally(() => opened.current.delete(n.id));
    }
    router.push(destination);
  };
  return <FlatList data={items} keyExtractor={(n) => n.id} contentContainerStyle={styles.list}
    refreshing={loading && loaded} onRefresh={() => { if (!readingAll.current) void load(); }}
    ListHeaderComponent={<View style={styles.header}>
      {header}
      <View style={ui.group}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>STAY IN THE LOOP</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Notifications</Text>
        <Text style={[ui.body, { color: colors.muted }]}>Follow your reports, public responses and conversations.</Text>
      </View>
      <View style={styles.toolbar}>
        <View style={styles.filters}>{(["all", "unread"] as const).map((value) => <Button key={value} compact label={value === "all" ? "All" : "Unread"} selected={filter === value} disabled={reading} onPress={() => {
          if (filter === value) return;
          pending.current?.abort(); setFilter(value); setItems([]); setNextCursor(null); setLoaded(false); setLoading(true); setMessage("");
        }} />)}</View>
        <Button label="Mark all as read" icon="check" variant="ghost" busy={reading} disabled={loading || unreadCount === null || unreadCount === 0} onPress={() => void markAll()} />
      </View>
      <View style={styles.summary}>
        <Text accessibilityLiveRegion="polite" style={[ui.caption, { color: colors.muted }]}>{unreadLabel(unreadCount)}</Text>
        <Button label="Refresh" icon="refresh-cw" variant="ghost" busy={loading} disabled={reading} onPress={() => { setMessage(""); void load(); }} />
      </View>
      {!!message && <Text role="status" accessibilityLiveRegion="polite" style={[ui.caption, { color: colors.success }]}>{message}</Text>}
      {!!error && <View style={ui.group}><Notice error>{error}</Notice><Button label="Retry loading notifications" disabled={loading || reading} onPress={() => void load()} /></View>}
    </View>}
    renderItem={({ item }) => <NotificationRow item={item} disabled={reading} onPress={() => open(item)} />}
    ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="Loading notifications" color={colors.primary} style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.surface }]} /> : loaded && !error ? <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Feather accessible={false} name={filter === "unread" ? "check-circle" : "bell"} size={28} color={colors.primary} />
      <Text style={[ui.heading, { color: colors.text }]}>{filter === "unread" ? "You’re all caught up" : "No notifications yet"}</Text>
      <Text style={[ui.body, styles.center, { color: colors.muted }]}>{filter === "unread" ? "You have no unread notifications." : "Government responses to your reports, comments and replies will appear here."}</Text>
    </View> : undefined}
    ListFooterComponent={nextCursor ? <View style={styles.footer}><Button label="Load more notifications" disabled={loading || reading} busy={loading} onPress={() => void load(nextCursor)} /></View> : undefined}
  />;
}
function NotificationRow({ item, onPress, disabled }: { item: InboxNotification; onPress: () => void; disabled: boolean }) {
  const { colors } = useTheme();
  const copy = notificationCopy(item), resolved = item.kind === "REPORT_RESOLVED", unread = !item.readAt;
  const when = new Date(item.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return <Pressable accessibilityRole="button" accessibilityLabel={`${unread ? "Unread: " : ""}${copy.title}. ${copy.body} ${item.postTitle}`} accessibilityHint="Opens the saved post or government update" disabled={disabled}
    style={({ pressed }) => [styles.card, { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed || disabled ? 0.65 : 1 }]} onPress={onPress}>
    <View style={[styles.icon, { backgroundColor: resolved ? colors.successBackground : colors.accent }]}><Feather accessible={false} name={copy.icon} color={resolved ? colors.success : colors.primary} size={20} /></View>
    <View style={styles.copy}>
      <View style={styles.cardHeading}><Text style={[ui.label, { flex: 1, color: resolved ? colors.success : colors.text }]}>{copy.title}</Text>{unread && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}</View>
      <Text style={[ui.body, { color: colors.text }]}>{copy.body}</Text>
      <Text numberOfLines={2} style={[ui.caption, { color: colors.muted, fontWeight: "600" }]}>{item.postTitle}</Text>
      <Text style={[ui.caption, { color: colors.muted }]}>{when}{unread ? " · Unread" : ""}</Text>
    </View>
  </Pressable>;
}
const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, gap: 10 },
  header: { gap: 16, paddingBottom: 6 },
  eyebrow: { fontSize: 11, lineHeight: 16, letterSpacing: 1.1, fontWeight: "700" },
  title: { fontSize: 28, lineHeight: 35, fontWeight: "700", letterSpacing: -0.55 },
  toolbar: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 },
  filters: { flexDirection: "row", gap: 8 },
  summary: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 12, minHeight: 88 },
  cardHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0, gap: 5 },
  empty: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: "center", gap: 10 },
  center: { textAlign: "center" },
  footer: { paddingTop: 8 },
});
