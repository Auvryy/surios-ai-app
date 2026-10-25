import Feather from "@expo/vector-icons/Feather";
import { useState, type Ref } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from "react-native";
import { useTheme } from "@/constants/theme";
import { ui } from "@/components/ui/controls";

export function PasswordField({ label, value, onChangeText, current = false, disabled, onSubmitEditing, ref }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  current?: boolean;
  disabled: boolean;
  onSubmitEditing?: () => void;
  ref?: Ref<TextInputInstance>;
}) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  return <View style={ui.group}>
    <Text style={[ui.label, { color: colors.text }]}>{label}</Text>
    <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TextInput ref={ref} accessibilityLabel={label} value={value} onChangeText={onChangeText}
        secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} spellCheck={false}
        autoComplete={current ? "current-password" : "new-password"} textContentType={current ? "password" : "newPassword"}
        maxLength={current ? 256 : 128} editable={!disabled} selectionColor={colors.primary}
        onSubmitEditing={onSubmitEditing} returnKeyType={label === "Confirm new password" ? "done" : "next"}
        style={[styles.input, { color: colors.text }]} />
      <Pressable accessibilityRole="button" accessibilityLabel={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
        disabled={disabled} accessibilityState={{ disabled }} onPress={() => setVisible((previous) => !previous)}
        style={({ pressed }) => [styles.visibility, { opacity: pressed || disabled ? 0.6 : 1 }]}>
        <Feather name={visible ? "eye-off" : "eye"} size={18} color={colors.muted} />
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  inputRow: { minHeight: 48, borderWidth: 1, borderRadius: 10, flexDirection: "row", alignItems: "center" },
  input: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, lineHeight: 23 },
  visibility: { width: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
});
