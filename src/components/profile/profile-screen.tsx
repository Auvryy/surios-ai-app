import Feather from "@expo/vector-icons/Feather";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { SessionUser } from "@/auth/contracts";
import { apiOrigin } from "@/auth/api";
import { useSession } from "@/auth/session-provider";
import { PostCard } from "@/components/citizen/community-feed";
import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton, Notice, ui } from "@/components/ui/controls";
import { useTheme } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { publicUrl } from "@/lib/feed";
import { chooseProfilePhoto, profileForm, releaseProfilePhoto } from "@/lib/profile-media";
import { isGovernment, parseProfilePage, parseSavedProfile, profileImageUrl, type ProfileChanges, type ProfilePage, type PublicProfile } from "@/lib/profile";
import { ProfileEditor } from "./profile-editor";

export function ProfileScreen({ user, onBack, onCreate, onMap, onChanged }: {
  user: SessionUser;
  onBack: () => void;
  onCreate: () => void;
  onMap: (id?: string) => void;
  onChanged: () => void;
}) {
  const { colors } = useTheme();
  const { request, retry: refreshSession, signOut, busy, notice } = useSession();
  const [data, setData] = useState<ProfilePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState<"avatar" | "cover" | null>(null);
  const pending = useRef<AbortController | null>(null);
  const lastPage = useRef(1);
  const updating = useRef(false);
  const choosing = useRef(false);
  const mounted = useRef(false);
  const fetchPage = useCallback((page: number) => {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    lastPage.current = page;
    return request(`/api/profile?page=${page}`, { signal: controller.signal }).then((response) => {
      const result = parseProfilePage(response, user.id, apiOrigin());
      if (!controller.signal.aborted && mounted.current) setData(result);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted && mounted.current)
        setError(cause instanceof ApiError ? cause.message : "Your profile could not be loaded. Please try again.");
    }).finally(() => {
      if (!controller.signal.aborted && mounted.current) setLoading(false);
    });
  }, [request, user.id]);
  const load = (page: number) => {
    setLoading(true); setError("");
    void fetchPage(page);
  };
  useEffect(() => {
    mounted.current = true; void fetchPage(1);
    return () => { mounted.current = false; pending.current?.abort(); };
  }, [fetchPage]);

  const save = async (changes: ProfileChanges) => {
    if (updating.current) throw new ApiError("A profile update is already in progress.");
    updating.current = true; setSaving(true); setError(""); setMessage("");
    // Do not let a pre-save read replace the newly saved identity.
    pending.current?.abort();
    setLoading(false);
    try {
      const saved = parseSavedProfile(await request("/api/profile", { method: "POST", form: profileForm(changes) }), user.id, apiOrigin());
      if (!mounted.current) return;
      setData((previous) => previous ? {
        ...previous, profile: { ...previous.profile, ...saved,
          ...(changes.governmentProfile ? { governmentProfile: {
            ...changes.governmentProfile, jurisdiction: changes.governmentProfile.jurisdiction.trim(), bio: changes.governmentProfile.bio.trim(),
          } } : {}),
        },
        feed: previous.feed.map((item) => ({ ...item, author: saved.name, authorAvatarUrl: saved.avatarUrl })),
      } : previous);
      setMessage("Profile updated.");
      onChanged();
      void refreshSession();
      load(lastPage.current);
    } finally {
      updating.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const changePhoto = async (kind: "avatar" | "cover") => {
    if (choosing.current || updating.current || !data) return;
    choosing.current = true; setPicking(kind); setError(""); setMessage("");
    let photo = null;
    try {
      photo = await chooseProfilePhoto();
      if (!photo || !mounted.current) return;
      await save({ name: data.profile.name, avatar: kind === "avatar" ? photo : null, cover: kind === "cover" ? photo : null, removeAvatar: false, removeCover: false });
      if (mounted.current) setMessage(kind === "avatar" ? "Profile picture updated." : "Cover photo updated.");
    } catch (cause) {
      if (mounted.current) setError(cause instanceof ApiError ? cause.message : "Your photo could not be updated. Please try again.");
    } finally {
      releaseProfilePhoto(photo); choosing.current = false;
      if (mounted.current) setPicking(null);
    }
  };
  const profile: PublicProfile = data?.profile || {
    id: user.id, name: user.name, role: user.role,
    avatarUrl: profileImageUrl(user.avatarUrl, apiOrigin()), coverUrl: null, governmentProfile: null,
  };
  const locked = saving || !!picking || busy;
  const canEdit = !!data?.isOwner && !locked;
  const office = isGovernment(profile.role);
  const back = <Pressable accessibilityRole="button" accessibilityLabel="Back to feed" onPress={onBack}
    style={({ pressed }) => [styles.back, { opacity: pressed ? 0.6 : 1 }]}>
    <Feather name="arrow-left" size={18} color={colors.muted} />
    <Text style={[ui.body, { color: colors.muted }]}>Back to feed</Text>
  </Pressable>;
  return (
    <>
      <FlatList data={data?.feed || []} keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
        refreshing={loading && !!data && !locked}
        onRefresh={() => { if (!locked && !editing) load(1); }}
        renderItem={({ item }) => <PostCard item={item} onMap={onMap} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={<View style={styles.header}>
          <View style={styles.toolbar}>{back}<IconButton label="Sign out" icon="log-out" disabled={locked} onPress={() => void signOut()} /></View>
          <View style={[styles.identity, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.cover, { backgroundColor: colors.accent }]}>
              {profile.coverUrl && <Image source={{ uri: profile.coverUrl }} accessibilityLabel={`${profile.name}'s cover photo`} resizeMode="cover" style={StyleSheet.absoluteFill} />}
              <Pressable accessibilityRole="button" accessibilityLabel="Change cover photo" disabled={!canEdit}
                accessibilityState={{ disabled: !canEdit }} onPress={() => void changePhoto("cover")}
                style={({ pressed }) => [styles.coverControl, { opacity: pressed || !canEdit ? 0.6 : 1 }]}>
                <Feather name="camera" size={16} color="#FFFFFF" />
                <Text style={styles.coverControlText}>{picking === "cover" ? "Uploading…" : "Change cover"}</Text>
              </Pressable>
            </View>
            <View style={styles.identityBody}>
              <View style={styles.identityActions}>
                <View style={[styles.avatarRing, { backgroundColor: colors.surface }]}>
                  <Avatar name={profile.name} uri={profile.avatarUrl} size={80} />
                  <Pressable accessibilityRole="button" accessibilityLabel="Change profile picture" disabled={!canEdit}
                    accessibilityState={{ disabled: !canEdit }} onPress={() => void changePhoto("avatar")}
                    style={({ pressed }) => [styles.avatarControl, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed || !canEdit ? 0.6 : 1 }]}>
                    <Feather name="camera" size={19} color={colors.text} />
                  </Pressable>
                </View>
                <Button label="Edit profile" icon="edit-2" disabled={!canEdit} onPress={() => setEditing(true)} />
              </View>
              <View style={styles.identityCopy}>
                <Text accessibilityRole="header" style={[styles.name, { color: colors.text }]}>{profile.name}</Text>
                {office && <Text style={[styles.office, { color: colors.primary }]}>
                  {profile.governmentProfile?.level === "BARANGAY" ? "Barangay office" : "Municipal office"}
                  {profile.governmentProfile?.jurisdiction ? ` · ${profile.governmentProfile.jurisdiction}` : ""}
                </Text>}
                {office && !!profile.governmentProfile?.bio && <Text style={[ui.body, { color: colors.muted }]}>{profile.governmentProfile.bio}</Text>}
                <Text selectable style={[ui.caption, { color: colors.muted }]}>{user.email}</Text>
                {data && <Text style={[ui.body, { color: colors.muted }]}>{data.total} {data.total === 1 ? "post" : "posts"}</Text>}
              </View>
              {office && data?.statistics && <View style={[styles.statistics, { borderColor: colors.border }]}>
                <View style={styles.statRow}>
                  {[{ label: "Reports handled", value: data.statistics.reports }, { label: "In progress", value: data.statistics.inProgress }, { label: "Resolved", value: data.statistics.resolved }].map((stat) =>
                    <View key={stat.label} style={styles.stat} accessibilityLabel={`${stat.label}: ${stat.value}`}>
                      <Text style={[ui.caption, { color: colors.muted }]}>{stat.label}</Text>
                      <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
                    </View>)}
                </View>
                <Text style={[ui.caption, { color: colors.muted }]}>Distinct reports attributed to this office’s latest official updates.</Text>
              </View>}
            </View>
          </View>
          {!!message && <View accessibilityLiveRegion="polite"><Notice>{message}</Notice></View>}
          {!!notice && <Notice error>{notice}</Notice>}
          <View style={[styles.postsHeading, { borderColor: colors.border }]}>
            <Text accessibilityRole="header" style={[ui.heading, { color: colors.text }]}>Posts</Text>
            <Button label="New post" variant="ghost" onPress={onCreate} />
          </View>
        </View>}
        ListEmptyComponent={!loading && !error ? <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Feather name="file-text" size={24} color={colors.muted} />
          <Text style={[ui.heading, { color: colors.text }]}>No posts yet.</Text>
          <Text style={[ui.body, styles.centered, { color: colors.muted }]}>Your infrastructure reports and shared updates will appear here.</Text>
          <Button label="Share an infrastructure update" variant="primary" onPress={onCreate} />
        </View> : undefined}
        ListFooterComponent={<View style={styles.footer}>
          {loading && <ActivityIndicator accessibilityLabel="Loading your profile" color={colors.primary} />}
          {!!error && <><Notice error>{error}</Notice><Button label="Retry loading profile" onPress={() => load(lastPage.current)} disabled={locked} /></>}
          {data?.hasMore && !error && <Button label="Load more posts" busy={loading} disabled={locked} onPress={() => load(data.currentPage + 1)} />}
          {user.role !== "CITIZEN" && <Button label="Open web workspace" icon="external-link" onPress={() => {
            void Linking.openURL(publicUrl("/dashboard", apiOrigin())).catch(() => setError("The web workspace could not be opened. Please try again."));
          }} />}
        </View>}
      />
      {editing && data && <ProfileEditor profile={data.profile} onSave={save} onClose={() => setEditing(false)} />}
    </>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 },
  header: { gap: 16, paddingBottom: 16 },
  toolbar: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  back: { minHeight: 48, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", gap: 8 },
  identity: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  cover: { aspectRatio: 3, width: "100%", position: "relative" },
  coverControl: { position: "absolute", bottom: 12, right: 12, minHeight: 48, flexDirection: "row", gap: 7, alignItems: "center", backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  coverControlText: { color: "#FFFFFF", fontSize: 12, lineHeight: 18, fontWeight: "500", flexShrink: 1 },
  identityBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  identityActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 8 },
  avatarRing: { marginTop: -40, padding: 4, borderRadius: 48, position: "relative" },
  avatarControl: { position: "absolute", right: -4, bottom: -4, height: 48, width: 48, borderWidth: 1, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  identityCopy: { gap: 5, marginTop: 2 },
  name: { fontSize: 22, lineHeight: 29, fontWeight: "600", letterSpacing: -0.45 },
  office: { fontSize: 14, lineHeight: 21, fontWeight: "500" },
  statistics: { borderTopWidth: 1, paddingTop: 16, gap: 10 },
  statRow: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, gap: 4 },
  statValue: { fontSize: 22, lineHeight: 29, fontWeight: "600", fontVariant: ["tabular-nums"] },
  postsHeading: { borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingBottom: 4 },
  separator: { height: 16 },
  footer: { gap: 14, paddingTop: 16 },
  empty: { borderWidth: 1, borderRadius: 12, padding: 24, alignItems: "center", gap: 12 },
  centered: { textAlign: "center" },
});
