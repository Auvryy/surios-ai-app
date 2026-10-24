import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountField, type AccountFieldName } from '@/components/auth/account-field';
import { BrandMark } from '@/components/auth/brand-mark';
import { useTheme } from '@/constants/theme';

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

  const submit = () => {
    const next: FieldErrors = {};
    if (isRegister && name.trim().length < 2) next.name = 'Enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (password.length < 8) next.password = 'Use at least 8 characters.';
    if (isRegister && password !== confirmPassword) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    setServerNotice('');
    if (Object.keys(next).length) return;
    setServerNotice(isRegister
      ? "Account registration isn't connected to the SuriOS server yet, so your details weren't submitted."
      : "Sign in isn't connected to the SuriOS server yet, so no login request was sent.");
  };

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
              {isRegister ? <AccountField name="name" label="Full name" value={name} error={errors.name} isRegister autoCapitalize="words" onChangeText={(value) => { setName(value); setErrors((current) => ({ ...current, name: undefined })); setServerNotice(''); }} /> : null}
              <AccountField name="email" label="Email address" value={email} error={errors.email} isRegister={isRegister} keyboardType="email-address" onChangeText={(value) => { setEmail(value); setErrors((current) => ({ ...current, email: undefined })); setServerNotice(''); }} />
              <AccountField name="password" label="Password" value={password} error={errors.password} isRegister={isRegister} secure hint={isRegister ? 'At least 8 characters' : undefined} onChangeText={(value) => { setPassword(value); setErrors((current) => ({ ...current, password: undefined })); setServerNotice(''); }} onSubmitEditing={!isRegister ? submit : undefined} />
              {isRegister ? <AccountField name="confirmPassword" label="Confirm password" value={confirmPassword} error={errors.confirmPassword} isRegister secure onChangeText={(value) => { setConfirmPassword(value); setErrors((current) => ({ ...current, confirmPassword: undefined })); setServerNotice(''); }} onSubmitEditing={submit} /> : null}
              {serverNotice ? <View accessibilityRole="alert" style={[styles.notice, { backgroundColor: colors.accent, borderColor: colors.border }]}><Text style={[styles.noticeText, { color: colors.text }]}>{serverNotice}</Text></View> : null}
              <Pressable accessibilityRole="button" onPress={submit} style={({ pressed }) => [styles.submit, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}>
                <Text style={[styles.submitText, { color: colors.onPrimary }]}>{isRegister ? 'Create account' : 'Sign in'}</Text>
              </Pressable>
              <View style={styles.switchRow}>
                <Text style={[styles.switchCopy, { color: colors.muted }]}>{isRegister ? 'Already have an account?' : 'New to SuriOS?'}</Text>
                <Link href={isRegister ? '/login' : '/register'} asChild>
                  <Pressable accessibilityRole="link" hitSlop={8}><Text style={[styles.switchLink, { color: colors.primary }]}>{isRegister ? 'Sign in' : 'Create an account'}</Text></Pressable>
                </Link>
              </View>
              <Link href="/citizen" asChild>
                <Pressable accessibilityRole="link" hitSlop={8} style={styles.previewLink}><Text style={[styles.previewLinkText, { color: colors.primary }]}>Explore the citizen feed preview</Text></Pressable>
              </Link>
            </View>
            <Text style={[styles.privacy, { color: colors.muted }]}>Your reports help communities track public infrastructure concerns. Sign-up is not yet connected to the service.</Text>
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
  submit: { minHeight: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center', padding: 12 }, submitText: { fontSize: 15, fontWeight: '600' },
  switchRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, flexWrap: 'wrap' },
  previewLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  previewLinkText: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  switchCopy: { fontSize: 14 }, switchLink: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  privacy: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
