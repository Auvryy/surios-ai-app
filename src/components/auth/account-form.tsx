import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountField, type AccountFieldName } from '@/components/auth/account-field';
import { BrandMark } from '@/components/auth/brand-mark';
import { useTheme } from '@/constants/theme';
import { ONBOARDING_COMPLETE_KEY } from '@/constants/onboarding';
import { useSession } from '@/auth/session-provider';
import { ApiError } from '@/lib/api-client';
import { SessionPanel } from './session-panel';

type AccountMode = 'login' | 'register';
type FieldErrors = Partial<Record<AccountFieldName, string>>;

export function AccountForm({ mode }: { mode: AccountMode }) {
  const isRegister = mode === 'register';
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverNotice, setServerNotice] = useState('');
  const { authenticate, cancelAuthentication, busy, status, session, notice } = useSession();
  const submitting = useRef(false);
  const fields = useRef<Partial<Record<AccountFieldName, TextInputInstance | null>>>({});

  useEffect(() => () => cancelAuthentication(), [cancelAuthentication]);

  const submit = async () => {
    if (submitting.current || busy) return;
    const next: FieldErrors = {};
    if (isRegister && (name.trim().length < 2 || name.trim().length > 120)) next.name = 'Use 2–120 characters for your name.';
    if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password || password.length > 256) next.password = 'Enter your password (up to 256 characters).';
    else if (isRegister && password.length < 8) next.password = 'Use at least 8 characters.';
    if (isRegister && password !== confirmPassword) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    setServerNotice('');
    const firstError = (Object.keys(next) as AccountFieldName[])[0];
    if (firstError) { fields.current[firstError]?.focus(); return; }
    submitting.current = true;
    try {
      await authenticate(mode, isRegister
        ? { name: name.trim(), email: email.trim().toLowerCase(), password, confirmPassword }
        : { email: email.trim().toLowerCase(), password });
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true').catch(() => {});
    } catch (error) {
      setServerNotice(error instanceof ApiError ? error.message : 'Sign-in could not be completed. Please try again.');
    } finally { submitting.current = false; }
  };

  if (status === 'loading' || status === 'unavailable') return <SessionPanel />;
  if (session) return <Redirect href="/citizen" />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={styles.container}>
            <BrandMark />
            <View style={styles.headingBlock}>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>{isRegister ? 'JOIN YOUR COMMUNITY' : 'WELCOME BACK'}</Text>
              <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{isRegister ? 'Create your account' : 'Sign in to SuriOS'}</Text>
              <Text style={[styles.description, { color: colors.muted }]}>{isRegister ? 'Create an account to share infrastructure reports and follow local responses.' : 'Continue to your community infrastructure reports and updates.'}</Text>
            </View>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{isRegister ? 'Your details' : 'Account details'}</Text>
              {isRegister ? <AccountField name="name" ref={(input) => { fields.current.name = input; }} label="Full name" value={name} error={errors.name} isRegister disabled={busy} autoCapitalize="words" onChangeText={(value) => { setName(value); setErrors((current) => ({ ...current, name: undefined })); setServerNotice(''); }} /> : null}
              <AccountField name="email" ref={(input) => { fields.current.email = input; }} label="Email address" value={email} error={errors.email} disabled={busy} isRegister={isRegister} keyboardType="email-address" onChangeText={(value) => { setEmail(value); setErrors((current) => ({ ...current, email: undefined })); setServerNotice(''); }} />
              <AccountField name="password" ref={(input) => { fields.current.password = input; }} label="Password" value={password} error={errors.password} disabled={busy} isRegister={isRegister} secure hint={isRegister ? 'At least 8 characters' : undefined} onChangeText={(value) => { setPassword(value); setErrors((current) => ({ ...current, password: undefined })); setServerNotice(''); }} onSubmitEditing={!isRegister ? () => void submit() : undefined} />
              {isRegister ? <AccountField name="confirmPassword" ref={(input) => { fields.current.confirmPassword = input; }} label="Confirm password" value={confirmPassword} error={errors.confirmPassword} disabled={busy} isRegister secure onChangeText={(value) => { setConfirmPassword(value); setErrors((current) => ({ ...current, confirmPassword: undefined })); setServerNotice(''); }} onSubmitEditing={() => void submit()} /> : null}
              {(serverNotice || notice) ? <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: colors.errorBackground, borderColor: colors.border }]}><Text style={[styles.noticeText, { color: colors.error }]}>{serverNotice || notice}</Text></View> : null}
              <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={() => void submit()} style={({ pressed }) => [styles.submit, { backgroundColor: colors.primary, opacity: pressed || busy ? 0.65 : 1 }]}>
                {busy && <ActivityIndicator color={colors.onPrimary} />}
                <Text style={[styles.submitText, { color: colors.onPrimary }]}>{busy ? (isRegister ? 'Creating account…' : 'Signing in…') : isRegister ? 'Create account' : 'Sign in'}</Text>
              </Pressable>
              <View style={styles.switchRow}>
                <Text style={[styles.switchCopy, { color: colors.muted }]}>{isRegister ? 'Already have an account?' : 'New to SuriOS?'}</Text>
                <Link href={isRegister ? '/login' : '/register'} asChild>
                  <Pressable accessibilityRole="link" disabled={busy} style={styles.switchButton}><Text style={[styles.switchLink, { color: colors.primary }]}>{isRegister ? 'Sign in' : 'Create an account'}</Text></Pressable>
                </Link>
              </View>
            </View>
            <Text style={[styles.privacy, { color: colors.muted }]}>{isRegister ? 'This creates a citizen account. Your account works on both the app and the SuriOS website.' : 'Use the same email and password as your SuriOS website account.'}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, keyboard: { flex: 1 }, scroll: { flexGrow: 1, padding: 24 },
  container: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: 24, paddingTop: 12, paddingBottom: 24 },
  headingBlock: { gap: 9 }, eyebrow: { fontSize: 11, letterSpacing: 1.25, fontWeight: '700' },
  title: { fontSize: 29, lineHeight: 36, letterSpacing: -0.55, fontWeight: '700' },
  description: { fontSize: 15, lineHeight: 23 },
  card: { borderWidth: 1, borderRadius: 12, padding: 20, gap: 19 },
  cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: -3 },
  fieldGroup: { gap: 7 }, labelRow: { minHeight: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '500' }, hint: { fontSize: 12 },
  inputWrap: { minHeight: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minHeight: 46, fontSize: 15, paddingVertical: 10 },
  showButton: { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }, showText: { fontSize: 13, fontWeight: '600' },
  errorText: { color: '#B42318', fontSize: 13, lineHeight: 18 },
  notice: { borderWidth: 1, borderRadius: 8, padding: 12 }, noticeText: { fontSize: 14, lineHeight: 20 },
  submit: { minHeight: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center', padding: 12, flexDirection: 'row', gap: 10 }, submitText: { fontSize: 15, fontWeight: '600' },
  switchRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, flexWrap: 'wrap' },
  switchButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  switchCopy: { fontSize: 14 }, switchLink: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  privacy: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
