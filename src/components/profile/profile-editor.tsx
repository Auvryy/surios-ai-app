import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { Avatar } from "@/components/ui/avatar";
import { Button, Field, Notice, Sheet, ui } from "@/components/ui/controls";
import { useTheme } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { chooseProfilePhoto, releaseProfilePhoto } from "@/lib/profile-media";
import { isGovernment, profileChangesError, type ProfileChanges, type ProfilePhoto, type PublicProfile } from "@/lib/profile";

export function ProfileEditor({ profile, onSave, onClose }: {
  profile: PublicProfile;
  onSave: (changes: ProfileChanges) => Promise<void>;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState(profile.name);
  const [level, setLevel] = useState(profile.governmentProfile?.level || "MUNICIPAL");
  const [jurisdiction, setJurisdiction] = useState(profile.governmentProfile?.jurisdiction || "");
  const [bio, setBio] = useState(profile.governmentProfile?.bio || "");
  const [avatar, setAvatar] = useState<ProfilePhoto | null>(null);
  const [cover, setCover] = useState<ProfilePhoto | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState<"avatar" | "cover" | null>(null);
  const [error, setError] = useState("");
  const operation = useRef(false);
  const mounted = useRef(false);
  const selected = useRef<{ avatar: ProfilePhoto | null; cover: ProfilePhoto | null }>({ avatar: null, cover: null });
  useEffect(() => {
    mounted.current = true;
    const photos = selected.current;
    return () => {
      mounted.current = false;
      releaseProfilePhoto(photos.avatar);
      releaseProfilePhoto(photos.cover);
    };
  }, []);
  const choose = async (kind: "avatar" | "cover") => {
    if (operation.current) return;
    operation.current = true;
    setPicking(kind); setError("");
    try {
      const photo = await chooseProfilePhoto();
      if (!mounted.current) { releaseProfilePhoto(photo); return; }
      if (!photo) return;
      releaseProfilePhoto(selected.current[kind]);
      selected.current[kind] = photo;
      if (kind === "avatar") { setAvatar(photo); setRemoveAvatar(false); }
      else { setCover(photo); setRemoveCover(false); }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof ApiError ? cause.message : "Your photo library could not be opened. Please try again.");
    } finally {
      operation.current = false;
      if (mounted.current) setPicking(null);
    }
  };
  const remove = (kind: "avatar" | "cover") => {
    releaseProfilePhoto(selected.current[kind]); selected.current[kind] = null;
    if (kind === "avatar") { setAvatar(null); setRemoveAvatar(true); }
    else { setCover(null); setRemoveCover(true); }
  };
  const save = async () => {
    if (operation.current) return;
    const changes: ProfileChanges = {
      name, avatar, cover, removeAvatar, removeCover,
      ...(isGovernment(profile.role) ? { governmentProfile: { level, jurisdiction, bio } } : {}),
    };
    const invalid = profileChangesError(changes);
    if (invalid) { setError(invalid); return; }
    operation.current = true; setBusy(true); setError("");
    try { await onSave(changes); if (mounted.current) onClose(); }
    catch (cause) {
      if (mounted.current) setError(cause instanceof ApiError ? cause.message : "Your profile could not be saved. Please try again.");
    } finally { operation.current = false; if (mounted.current) setBusy(false); }
  };
  const locked = busy || !!picking;
  const coverUri = removeCover ? null : cover?.uri || profile.coverUrl;
  return (
    <Sheet title="Edit profile" subtitle="Change your public name and profile photos." onClose={onClose} closeDisabled={locked}
      footer={<View style={ui.gap}>
        <Button label={busy ? "Saving…" : "Save changes"} variant="primary" busy={busy} disabled={!!picking} onPress={() => void save()} />
        <Button label="Cancel" variant="ghost" disabled={locked} onPress={onClose} />
      </View>}>
      <Field label="Name" value={name} onChangeText={setName} maxLength={80} autoComplete="name" textContentType="name" editable={!locked} />
      {isGovernment(profile.role) && <>
        <View style={ui.group}>
          <Text style={[ui.label, { color: colors.text }]}>Government level</Text>
          <View style={ui.row}>
            <Button label="Municipality" selected={level === "MUNICIPAL"} disabled={locked} onPress={() => setLevel("MUNICIPAL")} />
            <Button label="Barangay" selected={level === "BARANGAY"} disabled={locked} onPress={() => setLevel("BARANGAY")} />
          </View>
        </View>
        <Field label="Jurisdiction" placeholder="e.g. Santa Cruz, Laguna" value={jurisdiction} onChangeText={setJurisdiction} maxLength={120} editable={!locked} />
        <Field label="About this office" value={bio} onChangeText={setBio} multiline maxLength={500} editable={!locked} />
      </>}
      <View style={ui.group}>
        <Text style={[ui.label, { color: colors.text }]}>Profile picture</Text>
        <View style={styles.photoRow}>
          <Avatar name={name.trim() || profile.name} uri={removeAvatar ? null : avatar?.uri || profile.avatarUrl} size={64} />
          <View style={styles.photoActions}>
            <Button label={picking === "avatar" ? "Opening photos…" : "Choose photo"} accessibilityLabel="Choose profile picture" icon="image" disabled={locked} onPress={() => void choose("avatar")} />
          </View>
        </View>
        {!removeAvatar && (avatar || profile.avatarUrl) && <Button label="Remove profile picture" variant="ghost" disabled={locked} onPress={() => remove("avatar")} />}
        {removeAvatar && profile.avatarUrl && <Button label="Restore profile picture" variant="ghost" disabled={locked} onPress={() => setRemoveAvatar(false)} />}
      </View>
      <View style={ui.group}>
        <Text style={[ui.label, { color: colors.text }]}>Cover photo</Text>
        <View style={[styles.cover, { backgroundColor: colors.accent, borderColor: colors.border }]}>
          {coverUri ? <Image source={{ uri: coverUri }} accessibilityLabel="Cover preview" style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <Feather name="image" size={24} color={colors.primary} />}
        </View>
        <Button label={picking === "cover" ? "Opening photos…" : "Choose cover photo"} icon="image" disabled={locked} onPress={() => void choose("cover")} />
        {!removeCover && (cover || profile.coverUrl) && <Button label="Remove cover photo" variant="ghost" disabled={locked} onPress={() => remove("cover")} />}
        {removeCover && profile.coverUrl && <Button label="Restore cover photo" variant="ghost" disabled={locked} onPress={() => setRemoveCover(false)} />}
      </View>
      <Text style={[ui.caption, { color: colors.muted }]}>JPEG, PNG or WebP · Up to 4 MB per photo</Text>
      {!!error && <Notice error>{error}</Notice>}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  photoActions: { flex: 1, minWidth: 160 },
  cover: { aspectRatio: 3, width: "100%", borderRadius: 10, borderWidth: 1, overflow: "hidden", alignItems: "center", justifyContent: "center" },
});
