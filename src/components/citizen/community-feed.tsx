import Feather from '@expo/vector-icons/Feather';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiOrigin } from '@/auth/api';
import { useSession } from '@/auth/session-provider';
import { useTheme } from '@/constants/theme';
import { ApiError } from '@/lib/api-client';
import { parseFeedPage, publicUrl, type FeedCard, type FeedPage } from '@/lib/feed';

export function CommunityFeed({ header }: { header: ReactNode }) {
  const { colors } = useTheme();
  const { request } = useSession();
  const [data, setData] = useState<FeedPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const lastPage = useRef(1);
  const fetchPage = useCallback((page: number) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    lastPage.current = page;
    return request(`/api/community/posts?page=${page}`, { signal: controller.signal }).then((response) => {
      const result = parseFeedPage(response);
      // The API returns cumulative pages. Replace the collection rather than append duplicates.
      if (!controller.signal.aborted) { setData(result); setError(null); }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof ApiError ? cause.message : 'Reports could not be loaded. Please try again.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }, [request]);
  useEffect(() => { void fetchPage(1); return () => pending.current?.abort(); }, [fetchPage]);
  const load = (page: number) => { setLoading(true); setError(null); void fetchPage(page); };

  return (
    <FlatList
      data={data?.feed || []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<View style={styles.header}>{header}</View>}
      renderItem={({ item }) => <PostCard item={item} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      refreshing={loading && !!data}
      onRefresh={() => void load(1)}
      ListEmptyComponent={!loading && !error ? <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.surface }]}><Feather name="message-circle" size={28} color={colors.primary} /><Text style={[styles.title, { color: colors.text }]}>No reports yet</Text><Text style={[styles.body, { color: colors.muted }]}>Saved community reports and official updates will appear here.</Text></View> : undefined}
      ListFooterComponent={<View style={styles.footer}>
        {loading && <ActivityIndicator color={colors.primary} accessibilityLabel="Loading community reports" />}
        {error && <><Text accessibilityRole="alert" style={[styles.body, { color: colors.error }]}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load(lastPage.current)} style={[styles.button, { backgroundColor: colors.accent }]}><Text style={[styles.buttonText, { color: colors.primary }]}>Retry loading reports</Text></Pressable></>}
        {data?.hasMore && !error && <Pressable accessibilityRole="button" disabled={loading} accessibilityState={{ disabled: loading, busy: loading }} onPress={() => void load(data.currentPage + 1)} style={({ pressed }) => [styles.button, { borderColor: colors.border, borderWidth: 1, opacity: pressed || loading ? 0.65 : 1 }]}><Text style={[styles.buttonText, { color: colors.primary }]}>Load more reports</Text></Pressable>}
        <Text style={[styles.note, { color: colors.muted }]}>Posts come from your SuriOS server. Open a post to view its full discussion and evidence on the website.</Text>
      </View>}
    />
  );
}

function PostCard({ item }: { item: FeedCard }) {
  const { colors } = useTheme();
  const [linkError, setLinkError] = useState('');
  const open = async (path: string) => {
    try { setLinkError(''); await Linking.openURL(publicUrl(path, apiOrigin())); }
    catch { setLinkError('Could not open the website. Please try again.'); }
  };
  const resolved = item.status === 'RESOLVED';
  const status = resolved ? 'Resolved' : item.status === 'IN_REPAIR' ? 'In progress' : 'Reported';
  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.authorRow}>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}><Text style={[styles.buttonText, { color: colors.primary }]}>{item.author.split(' ').map((part) => part[0]).slice(0, 2).join('')}</Text></View>
        <View style={styles.authorCopy}><Text style={[styles.author, { color: colors.text }]}>{item.author}</Text><Text style={[styles.meta, { color: colors.muted }]}>{item.official ? 'Government update · ' : item.repost ? 'Repost · ' : ''}{new Date(item.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</Text></View>
      </View>
      <Pressable accessibilityRole="link" accessibilityLabel={`${status}${resolved && item.resolutionUrl ? ': view official explanation' : ': open report'}`} onPress={() => void open(resolved && item.resolutionUrl ? item.resolutionUrl : item.url)} style={({ pressed }) => [styles.status, { backgroundColor: resolved ? colors.successBackground : colors.accent, opacity: pressed ? 0.7 : 1 }]}>
        <Feather name={resolved ? 'check-circle' : 'info'} size={15} color={resolved ? colors.success : colors.primary} /><Text style={[styles.meta, { color: resolved ? colors.success : colors.primary, fontWeight: '700' }]}>{status}</Text>
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{item.title}</Text>
      {!!item.body && <Text style={[styles.body, { color: colors.text }]} numberOfLines={5}>{item.body}</Text>}
      {item.photoUrl && <View style={styles.imageWrap}><Image source={{ uri: publicUrl(item.photoUrl, apiOrigin()) }} accessibilityLabel={`Photo attached by ${item.author}`} resizeMode="cover" style={styles.image} />{item.photoCount > 1 && <View style={[styles.count, { backgroundColor: colors.surface }]}><Text style={[styles.meta, { color: colors.text }]}>+{item.photoCount - 1} photos</Text></View>}</View>}
      {item.originalTitle && <View style={[styles.quote, { borderColor: colors.border }]}><Text style={[styles.meta, { color: colors.muted }]}>Original report</Text><Text style={[styles.body, { color: colors.text }]}>{item.originalTitle}</Text></View>}
      {!!item.location && <Text style={[styles.meta, { color: colors.muted }]}>{item.location}</Text>}
      <Pressable accessibilityRole="link" accessibilityLabel="Open post" onPress={() => void open(item.url)} style={({ pressed }) => [styles.button, { backgroundColor: colors.accent, opacity: pressed ? 0.7 : 1 }]}><Text style={[styles.buttonText, { color: colors.primary }]}>Open post</Text><Feather name="arrow-up-right" accessible={false} aria-hidden size={17} color={colors.primary} /></Pressable>
      {!!linkError && <Text accessibilityRole="alert" style={[styles.meta, { color: colors.error }]}>{linkError}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 }, header: { paddingBottom: 20, gap: 20 },
  separator: { height: 16 }, card: { padding: 16, borderWidth: 1, borderRadius: 16, gap: 12 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, authorCopy: { flex: 1, gap: 2 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  author: { fontSize: 15, lineHeight: 22, fontWeight: '700' }, meta: { fontSize: 12, lineHeight: 18 },
  title: { fontSize: 18, lineHeight: 25, fontWeight: '700' }, body: { fontSize: 15, lineHeight: 23 },
  status: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, minHeight: 48, borderRadius: 24 },
  imageWrap: { position: 'relative' }, image: { width: '100%', height: 220, borderRadius: 10 },
  count: { position: 'absolute', right: 10, bottom: 10, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10 },
  quote: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 5 },
  button: { minHeight: 48, borderRadius: 10, padding: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  buttonText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  footer: { paddingTop: 20, gap: 16 }, note: { fontSize: 12, lineHeight: 18 },
  empty: { borderWidth: 1, borderRadius: 16, padding: 24, gap: 12, alignItems: 'center' },
});
