import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountField, type AccountFieldName } from '@/components/auth/account-field';
import { BrandMark } from '@/components/auth/brand-mark';
import { useTheme } from '@/constants/theme';
import { ONBOARDING_COMPLETE_KEY } from '@/constants/onboarding';
import { useSession } from '@/auth/session-provider';
import { authApi } from '@/auth/api';
import { ApiError } from '@/lib/api-client';
import { SessionPanel } from './session-panel';
import { OtpCodeInput } from './otp-code-input';
import { normalizeOtpCode } from '@/auth/otp-code';

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
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationNotice, setVerificationNotice] = useState('');
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetRequested, setResetRequested] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [resetNotice, setResetNotice] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const { authenticate, cancelAuthentication, resendVerification, confirmVerification, busy, status, session, notice } = useSession();
  const submitting = useRef(false);
  const fields = useRef<Partial<Record<AccountFieldName, TextInputInstance | null>>>({});

  useEffect(() => () => cancelAuthentication(), [cancelAuthentication]);

  const resend = async () => {
    if (verificationBusy) return;
    const target = (verificationEmail || email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      setVerificationNotice('Enter a valid email address first.');
      return;
    }
    setVerificationBusy(true);
    setVerificationNotice('');
    try { setVerificationNotice(await resendVerification(target)); }
    catch (error) { setVerificationNotice(error instanceof ApiError ? error.message : 'A new code could not be requested. Please try again.'); }
    finally { setVerificationBusy(false); }
  };

  const verify = async () => {
    if (verificationBusy || !verificationEmail) return;
    const code = normalizeOtpCode(verificationCode);
    if (!/^\d{6}$/.test(code)) { setVerificationNotice('Enter the 6-digit code from your email.'); return; }
    setVerificationBusy(true);
    setVerificationNotice('');
    try {
      await confirmVerification(verificationEmail, code);
      setVerificationEmail(null);
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true').catch(() => {});
    } catch (error) {
      setVerificationNotice(error instanceof ApiError ? error.message : 'The code could not be verified. Please try again.');
    } finally { setVerificationBusy(false); }
  };

  const requestReset = async () => {
    const target = forgotEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) { setResetNotice('Enter a valid email address.'); return; }
    setResetBusy(true);
    setResetNotice('');
    try {
      const message = await authApi.requestPasswordReset(target, new AbortController().signal);
      setForgotEmail(target);
      setResetRequested(true);
      setResetNotice(message);
    } catch (error) { setResetNotice(error instanceof ApiError ? error.message : 'The reset code could not be requested. Please try again.'); }
    finally { setResetBusy(false); }
  };

  const completeReset = async () => {
    if (resetBusy) return;
    const code = normalizeOtpCode(resetCode);
    if (!/^\d{6}$/.test(code)) { setResetNotice('Enter the 6-digit code from your email.'); return; }
    if (newPassword.length < 8 || newPassword.length > 128) { setResetNotice('Use a password between 8 and 128 characters.'); return; }
    if (newPassword !== newPasswordConfirm) { setResetNotice('The passwords do not match.'); return; }
    setResetBusy(true);
    setResetNotice('');
    try {
      const success = await authApi.resetPasswordWithCode({ email: forgotEmail.trim().toLowerCase(), code, newPassword, confirmPassword: newPasswordConfirm }, new AbortController().signal);
      setForgotOpen(false);
      setResetRequested(false);
      setResetCode('');
      setNewPassword('');
      setNewPasswordConfirm('');
      setPassword('');
      setServerNotice(success);
    } catch (error) { setResetNotice(error instanceof ApiError ? error.message : 'The password could not be reset. Please try again.'); }
    finally { setResetBusy(false); }
  };

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
      const result = await authenticate(mode, isRegister
        ? { name: name.trim(), email: email.trim().toLowerCase(), password, confirmPassword }
        : { email: email.trim().toLowerCase(), password });
      if (result && result.verificationRequired) {
        setVerificationEmail(result.email);
        setVerificationCode('');
        setVerificationNotice('');
        await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true').catch(() => {});
        return;
      }
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true').catch(() => {});
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Sign-in could not be completed. Please try again.';
      setServerNotice(message);
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
              <Text style={[styles.description, { color: colors.muted }]}>{isRegister ? 'We’ll email a verification code. Your account is created after you enter it.' : 'Continue to your community infrastructure reports and updates.'}</Text>
            </View>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{isRegister ? 'Your details' : 'Account details'}</Text>
              {isRegister ? <AccountField name="name" ref={(input) => { fields.current.name = input; }} label="Full name" value={name} error={errors.name} isRegister disabled={busy} autoCapitalize="words" onChangeText={(value) => { setName(value); setErrors((current) => ({ ...current, name: undefined })); setServerNotice(''); }} /> : null}
              <AccountField name="email" ref={(input) => { fields.current.email = input; }} label="Email address" value={email} error={errors.email} disabled={busy} isRegister={isRegister} keyboardType="email-address" onChangeText={(value) => { setEmail(value); setErrors((current) => ({ ...current, email: undefined })); setServerNotice(''); }} />
              <AccountField name="password" ref={(input) => { fields.current.password = input; }} label="Password" value={password} error={errors.password} disabled={busy} isRegister={isRegister} secure hint={isRegister ? 'At least 8 characters' : undefined} onChangeText={(value) => { setPassword(value); setErrors((current) => ({ ...current, password: undefined })); setServerNotice(''); }} onSubmitEditing={!isRegister ? () => void submit() : undefined} />
              {!isRegister ? <Pressable accessibilityRole="button" onPress={() => { setForgotEmail(email.trim().toLowerCase()); setResetNotice(''); setResetRequested(false); setForgotOpen(true); }} style={styles.forgotButton}><Text style={[styles.switchLink, { color: colors.primary }]}>Forgot password?</Text></Pressable> : null}
              {isRegister ? <AccountField name="confirmPassword" ref={(input) => { fields.current.confirmPassword = input; }} label="Confirm password" value={confirmPassword} error={errors.confirmPassword} disabled={busy} isRegister secure onChangeText={(value) => { setConfirmPassword(value); setErrors((current) => ({ ...current, confirmPassword: undefined })); setServerNotice(''); }} onSubmitEditing={() => void submit()} /> : null}
              {(serverNotice || notice) ? <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: colors.errorBackground, borderColor: colors.border }]}><Text style={[styles.noticeText, { color: colors.error }]}>{serverNotice || notice}</Text></View> : null}
              <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={() => void submit()} style={({ pressed }) => [styles.submit, { backgroundColor: colors.primary, opacity: pressed || busy ? 0.65 : 1 }]}>
                {busy && <ActivityIndicator color={colors.onPrimary} />}
                <Text style={[styles.submitText, { color: colors.onPrimary }]}>{busy ? (isRegister ? 'Sending code…' : 'Signing in…') : isRegister ? 'Continue with email' : 'Sign in'}</Text>
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

      <Modal visible={Boolean(verificationEmail)} transparent animationType="fade" onRequestClose={() => setVerificationEmail(null)}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKeyboard}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScroll}>
              <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text accessibilityRole="header" style={[styles.modalTitle, { color: colors.text }]}>Verify your email</Text>
                <Text style={[styles.description, { color: colors.muted }]}>Enter the 6-digit code sent to {verificationEmail}. Your account will be created after it is confirmed.</Text>
                <Text style={[styles.label, { color: colors.text }]}>Email code</Text>
                <OtpCodeInput accessibilityLabel="Email verification code" value={verificationCode} onChangeText={(value) => { setVerificationCode(value); setVerificationNotice(''); }} disabled={verificationBusy} />
                {verificationNotice ? <Text accessibilityRole="alert" style={[styles.noticeText, { color: colors.error }]}>{verificationNotice}</Text> : null}
                <Pressable accessibilityRole="button" accessibilityState={{ busy: verificationBusy, disabled: verificationBusy }} disabled={verificationBusy} onPress={() => void verify()} style={({ pressed }) => [styles.submit, { backgroundColor: colors.primary, opacity: pressed || verificationBusy ? 0.65 : 1 }]}>
                  {verificationBusy && <ActivityIndicator color={colors.onPrimary} />}
                  <Text style={[styles.submitText, { color: colors.onPrimary }]}>{verificationBusy ? 'Verifying…' : 'Verify and create account'}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityState={{ busy: verificationBusy, disabled: verificationBusy }} disabled={verificationBusy} onPress={() => void resend()} style={styles.modalSecondaryButton}><Text style={[styles.switchLink, { color: colors.primary }]}>{verificationBusy ? 'Please wait…' : 'Resend code'}</Text></Pressable>
                <Pressable accessibilityRole="button" disabled={verificationBusy} onPress={() => setVerificationEmail(null)} style={styles.modalSecondaryButton}><Text style={[styles.switchCopy, { color: colors.muted }]}>Close</Text></Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={forgotOpen} transparent animationType="fade" onRequestClose={() => setForgotOpen(false)}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKeyboard}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScroll}>
              <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text accessibilityRole="header" style={[styles.modalTitle, { color: colors.text }]}>{resetRequested ? 'Choose a new password' : 'Reset your password'}</Text>
                <Text style={[styles.description, { color: colors.muted }]}>{resetRequested ? `Enter the code sent to ${forgotEmail}, then choose a new password.` : 'We’ll send a 6-digit code to your email address.'}</Text>
                {!resetRequested ? <>
                  <Text style={[styles.label, { color: colors.text }]}>Email address</Text>
                  <TextInput accessibilityLabel="Password reset email" value={forgotEmail} onChangeText={setForgotEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" maxLength={254} placeholder="name@example.com" placeholderTextColor={colors.muted} style={[styles.codeInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]} />
                </> : <>
                  <Text style={[styles.label, { color: colors.text }]}>Email code</Text>
                  <OtpCodeInput accessibilityLabel="Password reset code" value={resetCode} onChangeText={(value) => { setResetCode(value); setResetNotice(''); }} disabled={resetBusy} />
                  <Text style={[styles.label, { color: colors.text }]}>New password</Text>
                  <TextInput accessibilityLabel="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" placeholder="At least 8 characters" placeholderTextColor={colors.muted} style={[styles.codeInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]} />
                  <Text style={[styles.label, { color: colors.text }]}>Confirm new password</Text>
                  <TextInput accessibilityLabel="Confirm new password" value={newPasswordConfirm} onChangeText={setNewPasswordConfirm} secureTextEntry autoComplete="new-password" textContentType="newPassword" placeholder="Repeat new password" placeholderTextColor={colors.muted} style={[styles.codeInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]} />
                </>}
                {resetNotice ? <Text accessibilityRole="alert" style={[styles.noticeText, { color: resetNotice.startsWith('If an account') ? colors.primary : colors.error }]}>{resetNotice}</Text> : null}
                <Pressable accessibilityRole="button" accessibilityState={{ busy: resetBusy, disabled: resetBusy }} disabled={resetBusy} onPress={() => void (resetRequested ? completeReset() : requestReset())} style={({ pressed }) => [styles.submit, { backgroundColor: colors.primary, opacity: pressed || resetBusy ? 0.65 : 1 }]}>
                  {resetBusy && <ActivityIndicator color={colors.onPrimary} />}
                  <Text style={[styles.submitText, { color: colors.onPrimary }]}>{resetBusy ? 'Please wait…' : resetRequested ? 'Reset password' : 'Send reset code'}</Text>
                </Pressable>
                {resetRequested ? <Pressable accessibilityRole="button" accessibilityState={{ busy: resetBusy, disabled: resetBusy }} disabled={resetBusy} onPress={() => void requestReset()} style={styles.modalSecondaryButton}><Text style={[styles.switchLink, { color: colors.primary }]}>{resetBusy ? 'Sending…' : 'Resend code'}</Text></Pressable> : null}
                <Pressable accessibilityRole="button" disabled={resetBusy} onPress={() => setForgotOpen(false)} style={styles.modalSecondaryButton}><Text style={[styles.switchCopy, { color: colors.muted }]}>Close</Text></Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  label: { fontSize: 14, fontWeight: '500' },
  errorText: { color: '#B42318', fontSize: 13, lineHeight: 18 },
  notice: { borderWidth: 1, borderRadius: 8, padding: 12 }, noticeText: { fontSize: 14, lineHeight: 20 },
  submit: { minHeight: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center', padding: 12, flexDirection: 'row', gap: 10 }, submitText: { fontSize: 15, fontWeight: '600' },
  switchRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, flexWrap: 'wrap' },
  switchButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 }, switchCopy: { fontSize: 14 },
  switchLink: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  forgotButton: { minHeight: 38, alignSelf: 'flex-end', justifyContent: 'center', paddingHorizontal: 3, marginTop: -14 },
  privacy: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'center', padding: 18 },
  modalKeyboard: { width: '100%', maxHeight: '100%' }, modalScroll: { flexGrow: 1, justifyContent: 'center' },
  modalCard: { alignSelf: 'center', width: '100%', maxWidth: 460, borderWidth: 1, borderRadius: 16, padding: 22, gap: 14 },
  modalTitle: { fontSize: 21, fontWeight: '700' },
  codeInput: { minHeight: 50, borderWidth: 1, borderRadius: 8, paddingHorizontal: 13, fontSize: 16 },
  modalSecondaryButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
});
