import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/auth/session-provider";
import { SessionPanel } from "@/components/auth/session-panel";
import { PostDetailsScreen } from "@/components/discussion/post-details-screen";
import { Button, Notice, ui } from "@/components/ui/controls";
import { useTheme } from "@/constants/theme";
import { validId } from "@/lib/discussion";
export default function PostRoute() {
  const { id, repost } = useLocalSearchParams<{
    id: string;
    repost?: string;
  }>();
  const { session, status } = useSession();
  const { colors } = useTheme();
  const router = useRouter();
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/citizen");
  };
  if (
    status === "loading" ||
    status === "unavailable" ||
    session?.user.accountStatus !== "ACTIVE"
  )
    return <SessionPanel />;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.shell}>
        {!validId(id) || (repost != null && !validId(repost)) ? (
          <View style={[ui.gap, { padding: 20 }]}>
            <Notice error>This post link is invalid.</Notice>
            <Button label="Back to feed" onPress={back} />
          </View>
        ) : (
          <PostDetailsScreen
            key={`${id}:${repost || ""}:${session.user.id}`}
            id={id}
            repostId={repost || null}
            onBack={back}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1 },
  shell: { flex: 1, width: "100%", maxWidth: 680, alignSelf: "center" },
});
