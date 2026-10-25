import Feather from "@expo/vector-icons/Feather";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextInputInstance } from "react-native";
import { useSession } from "@/auth/session-provider";
import { Button, Notice, ui } from "@/components/ui/controls";
import { useTheme } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import { confirmedMessage, parseSettings, passwordChangeError, type AccountSettings, type EmailPreferences } from "@/lib/settings";
import { PasswordField } from "./password-field";

type Operation = "preferences" | "password" | "recovery";
type Feedback = { error?: string; message?: string };

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const { request } = useSession();
  const [data, setData] = useState<AccountSettings | null>(null);
  const [draft, setDraft] = useState<EmailPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [active, setActive] = useState<Operation | null>(null);
  const [feedback, setFeedback] = useState<Record<Operation, Feedback>>({ preferences: {}, password: {}, recovery: {} });
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const nextInput = useRef<TextInputInstance | null>(null);
  const confirmInput = useRef<TextInputInstance | null>(null);
  const mounted = useRef(false);
  const operation = useRef<Operation | null>(null);
  const pending = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    return request("/api/settings", { signal: controller.signal }).then((response) => {
      const settings = parseSettings(response);
      if (mounted.current && !controller.signal.aborted) {
        setData(settings); setDraft(settings.preferences); setLoadError("");
      }
    }).catch((cause: unknown) => {
      if (mounted.current && !controller.signal.aborted)
        setLoadError(cause instanceof ApiError ? cause.message : "Your settings could not be loaded. Please try again.");
    }).finally(() => { if (mounted.current && !controller.signal.aborted) setLoading(false); });
  }, [request]);
  useEffect(() => {
    mounted.current = true; void load();
    return () => { mounted.current = false; pending.current?.abort(); };
  }, [load]);

  const status = (section: Operation, result: Feedback) => {
    if (mounted.current) setFeedback((previous) => ({ ...previous, [section]: result }));
  };
  const begin = (section: Operation) => {
    if (operation.current || !data) return false;
    operation.current = section; setActive(section); status(section, {}); return true;
  };
  const finish = () => {
    operation.current = null;
    if (mounted.current) setActive(null);
  };
  const savePreferences = async () => {
    if (!draft || !begin("preferences")) return;
    try {
      const saved = parseSettings(await request("/api/settings", { method: "PATCH", body: { emailComments: draft.emailComments, emailConfirmations: draft.emailConfirmations } }));
      if (mounted.current) { setData(saved); setDraft(saved.preferences); }
      status("preferences", { message: "Email preferences saved." });
    } catch (cause) {
      status("preferences", { error: cause instanceof ApiError ? cause.message : "Your preferences could not be saved. Please try again." });
    } finally { finish(); }
  };
  const changePassword = async () => {
    if (operation.current || !data) return;
    const input = { currentPassword, newPassword, confirmPassword };
    const invalid = passwordChangeError(input);
    if (invalid) { status("password", { error: invalid }); return; }
    if (!begin("password")) return;
    try {
      const message = confirmedMessage(await request("/api/auth/password", { method: "POST", body: input }), "success");
      if (mounted.current) { setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }
      status("password", { message });
    } catch (cause) {
      status("password", { error: cause instanceof ApiError ? cause.message : "Your password could not be changed. Please try again." });
    } finally { finish(); }
  };
  const resetLink = async () => {
    if (!data?.mailAvailable || !begin("recovery")) return;
    try {
      const message = confirmedMessage(await request("/api/settings/reset-link", { method: "POST" }), "message");
      status("recovery", { message });
    } catch (cause) {
      status("recovery", { error: cause instanceof ApiError ? cause.message : "Your reset link could not be requested. Please try again." });
    } finally { finish(); }
  };
  const locked = active !== null;
  const response = (section: Operation) => {
    const result = feedback[section];
    return result.error ? <Notice error>{result.error}</Notice> : result.message ?
      <Text role="status" accessibilityLiveRegion="polite" style={[ui.body, { color: colors.success }]}>{result.message}</Text> : null;
  };

  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" disabled={locked} accessibilityState={{ disabled: locked }} onPress={onBack}
        style={({ pressed }) => [styles.back, { opacity: pressed || locked ? 0.6 : 1 }]}>
        <Feather name="arrow-left" size={18} color={colors.muted} /><Text style={[ui.body, { color: colors.muted }]}>Back</Text>
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Settings</Text>
      {loading && <ActivityIndicator accessibilityLabel="Loading settings" color={colors.primary} />}
      {!!loadError && <View style={ui.gap}><Notice error>{loadError}</Notice><Button label="Retry loading settings" disabled={loading} onPress={() => { setLoading(true); setLoadError(""); void load(); }} /></View>}
      {data && draft && <>
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={ui.group}>
            <Text accessibilityRole="header" style={[ui.heading, { color: colors.text }]}>Email notifications</Text>
            <Text selectable style={[ui.caption, { color: colors.muted }]}>Send updates to {data.email}</Text>
          </View>
          <View>
            <Checkbox label="Comments and replies" description="Comments on your posts and replies to you." checked={draft.emailComments} disabled={locked} onChange={(value) => { setDraft({ ...draft, emailComments: value }); status("preferences", {}); }} />
            <View style={{ borderTopWidth: 1, borderColor: colors.border }} />
            <Checkbox label="Post likes" description="When someone likes your infrastructure update." checked={draft.emailConfirmations} disabled={locked} onChange={(value) => { setDraft({ ...draft, emailConfirmations: value }); status("preferences", {}); }} />
          </View>
          {!data.mailAvailable && <Text style={[ui.caption, { color: colors.muted }]}>Email delivery is currently unavailable. You can still save your preferences.</Text>}
          {response("preferences")}
          <Button label={active === "preferences" ? "Saving…" : "Save preferences"} busy={active === "preferences"} disabled={locked} onPress={() => void savePreferences()} />
        </View>
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text accessibilityRole="header" style={[ui.heading, { color: colors.text }]}>Password & security</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Change password" aria-expanded={passwordOpen} accessibilityState={{ expanded: passwordOpen, disabled: locked }} disabled={locked}
            onPress={() => setPasswordOpen((previous) => !previous)} style={({ pressed }) => [styles.disclosure, { opacity: pressed || locked ? 0.6 : 1 }]}>
            <Text style={[ui.label, { color: colors.text }]}>Change password</Text>
            <Feather name={passwordOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
          </Pressable>
          {passwordOpen && <View style={ui.gap}>
            <PasswordField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} current disabled={locked} onSubmitEditing={() => nextInput.current?.focus()} />
            <PasswordField ref={nextInput} label="New password" value={newPassword} onChangeText={setNewPassword} disabled={locked} onSubmitEditing={() => confirmInput.current?.focus()} />
            <PasswordField ref={confirmInput} label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} disabled={locked} onSubmitEditing={() => void changePassword()} />
            <Text style={[ui.caption, { color: colors.muted }]}>Use 8–128 characters. Changing your password signs out your other sessions.</Text>
            {response("password")}
            <Button label={active === "password" ? "Updating…" : "Update password"} variant="primary" busy={active === "password"} disabled={locked} onPress={() => void changePassword()} />
          </View>}
          <View style={[styles.recovery, { borderTopColor: colors.border }]}>
            <Text style={[ui.label, { color: colors.text }]}>Reset password by email</Text>
            <Text style={[ui.caption, { color: colors.muted }]}>Forgot your current password? Request a secure reset link.</Text>
            <Button label={active === "recovery" ? "Sending…" : "Email reset link"} busy={active === "recovery"} disabled={locked || !data.mailAvailable} onPress={() => void resetLink()} />
            {response("recovery")}
          </View>
        </View>
      </>}
    </ScrollView>
  </KeyboardAvoidingView>;
}

function Checkbox({ label, description, checked, disabled, onChange }: {
  label: string; description: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void;
}) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityHint={description} aria-checked={checked} accessibilityState={{ checked, disabled }} disabled={disabled}
    onPress={() => onChange(!checked)} style={({ pressed }) => [styles.checkboxRow, { opacity: pressed || disabled ? 0.6 : 1 }]}>
    <View style={styles.checkboxCopy}><Text style={[ui.label, { color: colors.text }]}>{label}</Text><Text style={[ui.caption, { color: colors.muted }]}>{description}</Text></View>
    <View style={[styles.checkbox, { borderColor: checked ? colors.primary : colors.border, backgroundColor: checked ? colors.primary : colors.surface }]}>
      {checked && <Feather name="check" size={15} color={colors.onPrimary} />}
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28, gap: 16 },
  back: { minHeight: 48, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 },
  title: { fontSize: 22, lineHeight: 29, fontWeight: "600", letterSpacing: -0.45, paddingHorizontal: 4 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 14 },
  checkboxRow: { minHeight: 76, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 16 },
  checkboxCopy: { flex: 1, gap: 4 },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  disclosure: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  recovery: { borderTopWidth: 1, paddingTop: 16, gap: 10 },
});
