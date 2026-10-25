import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session-provider';
import { apiOrigin } from '@/auth/api';
import { Screen } from '@/components/screen';
import { useTheme } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export function SessionPanel({ profile = false }: { profile?: boolean }) {
  const { colors } = useTheme();
  const { status, session, notice, retry, signOut, busy } = useSession();
  const user = session?.user;
  const pending = user?.accountStatus === 'PENDING';
  const rejected = user?.accountStatus === 'REJECTED';
  const unavailable = status === 'unavailable';
  if (status === 'loading') return (
    <View style={[styles.loading, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.primary} accessibilityLabel="Checking your SuriOS session" />
      <Text style={{ color: colors.muted }}>Checking your session…</Text>
    </View>
  );
  return (
    <SafeAreaView edges={profile ? [] : ['top']} style={{ flex: 1, backgroundColor: colors.background }}><Screen>
      <View style={styles.container}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>{profile ? 'YOUR ACCOUNT' : 'SURIOS ACCOUNT'}</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {unavailable ? 'Let’s reconnect' : pending ? 'Awaiting approval' : rejected ? 'Application not approved' : user?.name || 'Your account'}
        </Text>
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={[styles.icon, { backgroundColor: colors.accent }]}><Feather name={pending ? 'clock' : unavailable ? 'wifi-off' : 'user'} size={24} color={colors.primary} /></View>
          {user && <>
            <Text style={[styles.name, { color: colors.text }]}>{user.name}</Text>
            <Text selectable style={[styles.body, { color: colors.muted }]}>{user.email}</Text>
            <Text style={[styles.badge, { color: colors.primary, backgroundColor: colors.accent }]}>{user.role === 'CITIZEN' ? 'Citizen' : user.role === 'ADMIN' ? 'Administrator' : 'Government'} · {pending ? 'Pending' : rejected ? 'Rejected' : 'Active'}</Text>
          </>}
          <Text style={[styles.body, { color: colors.muted }]}>
            {unavailable ? 'We couldn’t verify your saved session. It is kept on this device so you can retry without entering your password again.'
              : pending ? 'An administrator needs to approve your government account before you can access reports. Check again after approval.'
                : rejected ? 'Your government registration was not approved. Contact your administrator to review the application.'
                  : 'You’re signed in with the same account used on the SuriOS website.'}
          </Text>
          {notice && <Text accessibilityRole="alert" style={[styles.body, { color: colors.error }]}>{notice}</Text>}
          {(unavailable || pending || rejected) && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void retry()} style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: pressed || busy ? 0.65 : 1 }]}><Text style={[styles.buttonText, { color: colors.onPrimary }]}>Try again</Text></Pressable>}
          {user && user.role !== 'CITIZEN' && !pending && !rejected && <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`${apiOrigin()}/dashboard`)} style={({ pressed }) => [styles.button, { backgroundColor: colors.accent, opacity: pressed ? 0.7 : 1 }]}><Text style={[styles.buttonText, { color: colors.primary }]}>Open web workspace</Text></Pressable>}
          <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ busy, disabled: busy }} onPress={() => void signOut()} style={({ pressed }) => [styles.button, { borderWidth: 1, borderColor: colors.border, opacity: pressed || busy ? 0.65 : 1 }]}>
            {busy ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.buttonText, { color: colors.text }]}>{unavailable ? 'Sign out of this device' : 'Sign out'}</Text>}
          </Pressable>
        </View>
      </View>
    </Screen></SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  container: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: 16, paddingVertical: 16 },
  eyebrow: { fontSize: 11, letterSpacing: 1.1, fontWeight: '700' },
  title: { fontSize: 28, lineHeight: 35, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 14, alignItems: 'center' },
  icon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 20, lineHeight: 28, fontWeight: '700', textAlign: 'center' },
  badge: { fontSize: 13, lineHeight: 20, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 16, overflow: 'hidden' },
  body: { fontSize: 15, lineHeight: 23, textAlign: 'center' },
  button: { minHeight: 50, width: '100%', borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 12 },
  buttonText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
