import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/constants/theme';
import { normalizeOtpCode } from '@/auth/otp-code';

type Props = {
  accessibilityLabel: string;
  value: string;
  onChangeText: (value: string) => void;
  disabled?: boolean;
};

export function OtpCodeInput({ accessibilityLabel, value, onChangeText, disabled = false }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const focusIndex = Math.min(value.length, 5);
  return (
    <View style={styles.field}>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Enter the six-digit code sent to your email"
        value={value}
        onChangeText={(text) => onChangeText(normalizeOtpCode(text))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoCapitalize="none"
        autoCorrect={false}
        selectionColor={colors.primary}
        style={styles.input}
      />
      <View accessible={false} pointerEvents="none" style={styles.slots}>
        {Array.from({ length: 6 }, (_, index) => (
          <View key={index} style={[styles.slot, {
            borderColor: focused && index === focusIndex ? colors.primary : colors.border,
            backgroundColor: value[index] ? colors.surface : colors.background,
          }]}>
            <Text style={[styles.digit, { color: value[index] ? colors.text : colors.muted }]}>{value[index] || '0'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { minHeight: 54, justifyContent: 'center', position: 'relative' },
  input: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 2, opacity: 0.01, color: 'transparent', fontSize: 20, padding: 0, borderWidth: 0 },
  slots: { width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  slot: { width: '14%', maxWidth: 42, aspectRatio: 1, borderWidth: 1.5, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  digit: { fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
