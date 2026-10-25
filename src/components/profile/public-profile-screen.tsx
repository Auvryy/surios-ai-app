import { useCallback, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { apiOrigin } from "@/auth/api";
import { useSession } from "@/auth/session-provider";
import { PostCard } from "@/components/citizen/community-feed";
import { Avatar } from "@/components/ui/avatar";
import { Button, Notice, ui } from "@/components/ui/controls";
import { useTheme } from "@/constants/theme";
import { validId } from "@/lib/discussion";
import { isGovernment, parsePublicProfilePage, type ProfilePage } from "@/lib/profile";

/** Public identity and saved posts only. The Profile tab keeps its own account editor. */
export function PublicProfileScreen({ id, header, onBack, onMap, onOwnProfile }: {
  id: string;
  header: ReactNode;
  onBack: () => void;
  onMap: (id?: string) => void;
  onOwnProfile: () => void;
}) {
  const { colors } = useTheme();
  const { request, session } = useSession();
  const [data, setData] = useState<ProfilePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  const lastPage = useRef(1);
  const fetchPage = useCallback((page: number) => {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setLoading(true); setError(""); lastPage.current = page;
    if (!validId(id)) { setData(null); setLoading(false); setError("Profile not found."); return; }
    void request(`/api/profiles/${encodeURIComponent(id)}?page=${page}`, { signal: controller.signal }).then((response) => {
      const result = parsePublicProfilePage(response, id, session?.user.id || "", apiOrigin());
      if (!controller.signal.aborted) setData(result);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "This profile could not be loaded. Please try again.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }, [request, id, session?.user.id]);
  useFocusEffect(useCallback(() => { setData(null); fetchPage(1); return () => pending.current?.abort(); }, [fetchPage]));
  const profile = data?.profile;
  const office = profile && isGovernment(profile.role);
  return <FlatList data={data?.feed || []} keyExtractor={(item) => item.id}
    contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
    refreshing={loading && !!data} onRefresh={() => fetchPage(1)}
    renderItem={({ item }) => <PostCard item={item} onMap={onMap} onDeleted={() => fetchPage(lastPage.current)} />}
    ItemSeparatorComponent={() => <View style={styles.separator} />}
    ListHeaderComponent={<View style={styles.header}>
      {header}
      <Button label="Back to community feed" variant="ghost" icon="arrow-left" onPress={onBack} />
      <Text style={[ui.caption, { color: colors.muted }]}>COMMUNITY FEED · CONTRIBUTOR</Text>
      {profile && <View style={[styles.identity, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={[styles.cover, { backgroundColor: colors.accent }]}>
          {profile.coverUrl && <Image source={{ uri: profile.coverUrl }} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityLabel={`${profile.name}'s cover photo`} />}
        </View>
        <View style={styles.identityBody}>
          <View style={[styles.avatar, { backgroundColor: colors.surface }]}><Avatar name={profile.name} uri={profile.avatarUrl} size={80} /></View>
          <Text accessibilityRole="header" style={[ui.title, { color: colors.text }]}>{profile.name}</Text>
          {office && <Text style={[ui.label, { color: colors.primary }]}>{profile.governmentProfile?.level === "BARANGAY" ? "Barangay office" : "Municipal office"}{profile.governmentProfile?.jurisdiction ? ` · ${profile.governmentProfile.jurisdiction}` : ""}</Text>}
          {!!profile.governmentProfile?.bio && <Text style={[ui.body, { color: colors.muted }]}>{profile.governmentProfile.bio}</Text>}
          <Text style={[ui.body, { color: colors.muted }]}>{data.total} {data.total === 1 ? "post" : "posts"}</Text>
          {office && data.statistics && <View style={[styles.statistics, { borderColor: colors.border }]}>
            {[{ label: "Reports handled", value: data.statistics.reports }, { label: "In progress", value: data.statistics.inProgress }, { label: "Resolved", value: data.statistics.resolved }].map((stat) =>
              <View key={stat.label} style={styles.stat}><Text style={[ui.caption, { color: colors.muted }]}>{stat.label}</Text><Text style={[ui.title, { color: colors.text }]}>{stat.value}</Text></View>)}
            <Text style={[ui.caption, { color: colors.muted }]}>Distinct reports attributed to this office’s latest official updates.</Text>
          </View>}
          {data.isOwner && <Button label="Open your account profile" icon="user" onPress={onOwnProfile} />}
        </View>
      </View>}
      {profile && <Text accessibilityRole="header" style={[ui.heading, { color: colors.text }]}>Posts by {profile.name}</Text>}
    </View>}
    ListEmptyComponent={data && !loading && !error ? <View style={[ui.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[ui.heading, { color: colors.text }]}>No posts yet</Text>
      <Text style={[ui.body, { color: colors.muted }]}>This contributor’s saved reports and updates will appear here.</Text>
    </View> : undefined}
    ListFooterComponent={<View style={styles.footer}>
      {loading && <ActivityIndicator color={colors.primary} accessibilityLabel="Loading contributor profile" />}
      {!!error && <><Notice error>{error}</Notice><Button label="Retry loading contributor" onPress={() => fetchPage(lastPage.current)} /></>}
      {data?.hasMore && !error && <Button label="Load more contributor posts" busy={loading} onPress={() => fetchPage(data.currentPage + 1)} />}
    </View>} />;
}

const styles = StyleSheet.create({
  list: { padding: 20, paddingBottom: 28 },
  header: { gap: 16, paddingBottom: 16 },
  separator: { height: 16 },
  footer: { gap: 14, paddingTop: 16 },
  identity: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  cover: { width: "100%", aspectRatio: 3 },
  identityBody: { padding: 16, gap: 10 },
  avatar: { marginTop: -56, padding: 4, borderRadius: 48, alignSelf: "flex-start" },
  statistics: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, paddingTop: 14, gap: 12 },
  stat: { flex: 1, minWidth: 75, gap: 4 },
});
