import Feather from "@expo/vector-icons/Feather";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/constants/theme";
import { useReducedMotion } from "@/lib/use-reduced-motion";

type Icon = ComponentProps<typeof Feather>["name"];
export function Button({
  label,
  onPress,
  icon,
  variant = "outline",
  disabled = false,
  busy = false,
  selected,
  compact = false,
  accessibilityLabel,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  icon?: Icon;
  variant?: "primary" | "outline" | "ghost" | "danger";
  disabled?: boolean;
  busy?: boolean;
  selected?: boolean;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const filled = variant === "primary",
    color = filled
      ? colors.onPrimary
      : variant === "danger"
        ? colors.error
        : selected
          ? colors.primary
          : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{
        disabled: disabled || busy,
        busy,
        ...(selected === undefined ? {} : { selected }),
      }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        ui.button,
        compact && ui.compact,
        {
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: variant === "ghost" ? 0 : 1,
          backgroundColor: filled
            ? colors.primary
            : selected
              ? colors.accent
              : colors.surface,
          opacity: pressed || disabled || busy ? 0.6 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        icon && (
          <Feather accessible={false} name={icon} size={18} color={color} />
        )
      )}
      <Text style={[ui.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}
export function IconButton({
  label,
  icon,
  onPress,
  disabled,
  primary = false,
}: {
  label: string;
  icon: Icon;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        ui.icon,
        {
          backgroundColor: primary ? colors.primary : colors.surface,
          borderColor: colors.border,
          opacity: pressed || disabled ? 0.6 : 1,
        },
      ]}
    >
      <Feather
        name={icon}
        size={20}
        color={primary ? colors.onPrimary : colors.text}
      />
    </Pressable>
  );
}
export function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "orange" | "success" | "critical";
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        ui.chip,
        {
          backgroundColor:
            tone === "orange"
              ? colors.accent
              : tone === "success"
                ? colors.successBackground
                : tone === "critical"
                  ? colors.errorBackground
                  : colors.background,
          borderColor: colors.border,
        },
      ]}
    >
      <Text
        style={[
          ui.caption,
          {
            fontWeight: "600",
            color:
              tone === "orange"
                ? colors.primary
                : tone === "success"
                  ? colors.success
                  : tone === "critical"
                    ? colors.error
                    : colors.text,
          },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={ui.group}>
      <Text style={[ui.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        selectionColor={colors.primary}
        {...props}
        style={[
          ui.input,
          props.multiline && ui.multiline,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          props.style,
        ]}
      />
    </View>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        ui.notice,
        {
          borderColor: colors.border,
          backgroundColor: error ? colors.errorBackground : colors.accent,
        },
      ]}
    >
      <Feather
        name={error ? "alert-circle" : "info"}
        size={18}
        color={error ? colors.error : colors.primary}
      />
      <Text
        accessibilityRole={error ? "alert" : undefined}
        accessibilityLiveRegion="polite"
        style={[
          ui.body,
          { flex: 1, color: error ? colors.error : colors.text },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  scroll = true,
  closeDisabled = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  closeDisabled?: boolean;
}) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  return (
    <Modal
      visible
      transparent
      animationType={reducedMotion ? "none" : "slide"}
      onRequestClose={() => {
        if (!closeDisabled) onClose();
      }}
      statusBarTranslucent
    >
      <View style={ui.backdrop}>
        <Pressable
          accessible={false}
          aria-hidden
          disabled={closeDisabled}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={ui.keyboard}
          pointerEvents="box-none"
        >
          <SafeAreaView
            edges={["bottom"]}
            style={[ui.sheet, { backgroundColor: colors.surface }]}
            accessibilityViewIsModal
          >
            <View style={[ui.handle, { backgroundColor: colors.border }]} />
            <View
              style={[ui.sheetHeader, { borderBottomColor: colors.border }]}
            >
              <View style={ui.headerCopy}>
                <Text
                  accessibilityRole="header"
                  style={[ui.title, { color: colors.text }]}
                >
                  {title}
                </Text>
                {subtitle && (
                  <Text style={[ui.caption, { color: colors.muted }]}>
                    {subtitle}
                  </Text>
                )}
              </View>
              <IconButton
                label={`Close ${title}`}
                icon="x"
                onPress={onClose}
                disabled={closeDisabled}
              />
            </View>
            {scroll ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={ui.sheetBody}
              >
                {children}
              </ScrollView>
            ) : (
              <View style={ui.sheetList}>{children}</View>
            )}
            {footer && (
              <View style={[ui.sheetFooter, { borderTopColor: colors.border }]}>
                {footer}
              </View>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
export const ui = StyleSheet.create({
  button: {
    minHeight: 48,
    maxWidth: "100%",
    borderRadius: 11,
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  compact: { borderRadius: 24, paddingHorizontal: 13 },
  buttonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    flexShrink: 1,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    alignSelf: "flex-start",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  title: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.35,
  },
  heading: { fontSize: 16, lineHeight: 23, fontWeight: "700" },
  body: { fontSize: 14, lineHeight: 21 },
  caption: { fontSize: 12, lineHeight: 18 },
  label: { fontSize: 14, lineHeight: 21, fontWeight: "600" },
  group: { gap: 7 },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 16,
    lineHeight: 23,
  },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  gap: { gap: 14 },
  card: { padding: 14, borderWidth: 1, borderRadius: 14, gap: 12 },
  notice: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.38)",
    justifyContent: "flex-end",
  },
  keyboard: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    justifyContent: "flex-end",
    maxHeight: "94%",
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    maxHeight: "100%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
  },
  sheetHeader: {
    padding: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  headerCopy: { flex: 1, gap: 4 },
  sheetBody: { padding: 16, paddingBottom: 28, gap: 18 },
  sheetList: { flexShrink: 1, minHeight: 200 },
  sheetFooter: { padding: 16, gap: 8, borderTopWidth: 1 },
});
