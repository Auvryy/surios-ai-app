import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from '@/components/auth/brand-mark';
import { OnboardingArt } from '@/components/auth/onboarding-art';
import { ONBOARDING_COMPLETE_KEY } from '@/constants/onboarding';
import { useTheme } from '@/constants/theme';

const pages = [
  { kind: 'report' as const, eyebrow: 'COMMUNITY INFRASTRUCTURE', title: 'A closer look can make a difference.', body: 'Share clear evidence when something in your community needs attention, from roads and bridges to drainage and utility services.' },
  { kind: 'locate' as const, eyebrow: 'PUT IT ON THE MAP', title: 'Help your community find the issue.', body: 'Add a point on the street map so residents and local offices can understand where the concern is.' },
  { kind: 'follow' as const, eyebrow: 'FOLLOW THE RESPONSE', title: 'See what happens after a report.', body: 'Follow official progress and resolution updates with the evidence behind each response.' },
];

export default function OnboardingScreen() {
  const [page, setPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const { colors } = useTheme();
  const current = pages[page]!;
  const finish = async (destination: '/register' | '/login' = '/register') => {
    if (saving) return;
    setSaving(true);
    try { await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true'); }
    catch { /* Continue into the app; if storage is unavailable, the intro can show again next launch. */ }
    router.replace(destination);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        <View style={styles.topBar}><BrandMark /><Pressable accessibilityRole="button" accessibilityLabel="Skip introduction and create an account" onPress={() => void finish()} hitSlop={12}><Text style={[styles.skip, { color: colors.muted }]}>Skip</Text></Pressable></View>
        <View style={styles.content}>
          <OnboardingArt kind={current.kind} />
          <View style={styles.copy}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>{current.eyebrow}</Text>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{current.title}</Text>
            <Text style={[styles.body, { color: colors.muted }]}>{current.body}</Text>
          </View>
          <View style={styles.indicators} accessibilityLabel={`Introduction page ${page + 1} of ${pages.length}`}>
            {pages.map((item, index) => <View key={item.eyebrow} style={[styles.indicator, { backgroundColor: index === page ? colors.primary : colors.border, width: index === page ? 28 : 8 }]} />)}
          </View>
        </View>
        <View style={styles.bottom}>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => page < pages.length - 1 ? setPage(page + 1) : void finish('/register')} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary, opacity: saving || pressed ? 0.75 : 1 }]}>
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{page === pages.length - 1 ? 'Create an account' : 'Next'}</Text>
            {page < pages.length - 1 && <Text aria-hidden style={[styles.arrow, { color: colors.onPrimary }]}>→</Text>}
          </Pressable>
          <View style={styles.signInRow}><Text style={[styles.signInCopy, { color: colors.muted }]}>Already have an account?</Text><Pressable accessibilityRole="link" onPress={() => void finish('/login')} hitSlop={8}><Text style={[styles.signInLink, { color: colors.primary }]}>Sign in</Text></Pressable></View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
  topBar: { minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skip: { fontSize: 15, fontWeight: '600', padding: 8 },
  content: { flex: 1, justifyContent: 'center', gap: 26, paddingVertical: 18 },
  copy: { gap: 10 },
  eyebrow: { fontSize: 11, letterSpacing: 1.3, fontWeight: '700' },
  title: { fontSize: 30, lineHeight: 37, fontWeight: '700', letterSpacing: -0.65 },
  body: { fontSize: 16, lineHeight: 24 },
  indicators: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  indicator: { height: 8, borderRadius: 5 },
  bottom: { gap: 16, paddingBottom: 6 },
  primaryButton: { minHeight: 54, borderRadius: 10, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9 },
  buttonText: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  arrow: { fontSize: 20, lineHeight: 24 },
  signInRow: { minHeight: 34, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
  signInCopy: { fontSize: 14 },
  signInLink: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});
