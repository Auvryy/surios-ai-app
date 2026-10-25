import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/auth/session-provider";
import { SessionPanel } from "@/components/auth/session-panel";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { useTheme } from "@/constants/theme";

export default function SettingsRoute() {
  const { session, status } = useSession();
  const { colors } = useTheme();
  const router = useRouter();
  if (status === "loading" || status === "unavailable" || session?.user.accountStatus !== "ACTIVE") return <SessionPanel />;
  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
    <View style={styles.shell}>
      <SettingsScreen onBack={() => { if (router.canGoBack()) router.back(); else router.replace("/profile"); }} />
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1 }, shell: { flex: 1, width: "100%", maxWidth: 520, alignSelf: "center" } });
