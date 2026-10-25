import Feather from "@expo/vector-icons/Feather";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "@/auth/session-provider";
import { apiOrigin } from "@/auth/api";
import { useTheme } from "@/constants/theme";
import { profileImageUrl } from "@/lib/profile";
import { Avatar } from "@/components/ui/avatar";
import { Notice } from "@/components/ui/controls";
import { chooseEvidence } from "@/reporting/media";
import { mediaError, type Attachment } from "@/reporting/contracts";

export function FeedComposer({ onCreate }: { onCreate: (files?: Attachment[]) => void }) {
  const { session } = useSession();
  const { colors } = useTheme();
  const [picking, setPicking] = useState<"photo" | "video" | null>(null);
  const [error, setError] = useState("");
  const selecting = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const choose = async (kind: "photo" | "video") => {
    if (selecting.current) return;
    selecting.current = true;
    setPicking(kind); setError("");
    try {
      const files = await chooseEvidence(false, kind);
      if (!alive.current || !files.length) return;
      const invalid = mediaError(files);
      if (invalid) { setError(invalid); return; }
      onCreate(files);
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : "Could not select evidence. Try again.");
    } finally {
      selecting.current = false;
      if (alive.current) setPicking(null);
    }
  };
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.promptRow}>
        <Avatar name={session?.user.name || "Citizen"} uri={profileImageUrl(session?.user.avatarUrl, apiOrigin())} size={40} />
        <Pressable accessibilityRole="button" accessibilityLabel="Start a community infrastructure report" disabled={!!picking} onPress={() => onCreate()}
          style={({ pressed }) => [styles.prompt, { backgroundColor: colors.background, opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[styles.promptText, { color: colors.muted }]}>What’s happening with local infrastructure?</Text>
        </Pressable>
      </View>
      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        {[
          { label: "Photos", icon: "image", kind: "photo" as const },
          { label: "Video", icon: "video", kind: "video" as const },
          { label: "Location", icon: "map-pin", kind: null },
        ].map((action) => (
          <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={`Start a post with ${action.label.toLowerCase()}`}
            disabled={!!picking} accessibilityState={{ disabled: !!picking, busy: !!action.kind && picking === action.kind }}
            accessibilityHint={action.kind ? "Choose evidence to start your post" : "Opens the post composer to add a location"}
            onPress={() => action.kind ? void choose(action.kind) : onCreate()}
            style={({ pressed }) => [styles.action, { backgroundColor: pressed ? colors.accent : colors.surface }]}>
            {action.kind && picking === action.kind ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name={action.icon as "image" | "video" | "map-pin"} size={17} color={colors.primary} accessible={false} />}
            <Text style={[styles.actionText, { color: colors.text }]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
      {!!error && <Notice error>{error}</Notice>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, paddingBottom: 4, borderRadius: 16, borderWidth: 1, gap: 10 },
  promptRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  prompt: { flex: 1, minHeight: 48, borderRadius: 24, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 10 },
  promptText: { fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: "row", borderTopWidth: 1, paddingTop: 4, gap: 4 },
  action: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 6, paddingVertical: 6, borderRadius: 10 },
  actionText: { fontSize: 12, lineHeight: 18, fontWeight: "500" },
});
