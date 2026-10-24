import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/constants/theme';

export type AccountFieldName = 'name' | 'email' | 'password' | 'confirmPassword';
type Props = {
  name: AccountFieldName;
  label: string;
  value: string;
  error?: string;
  isRegister: boolean;
  hint?: string;
  autoCapitalize?: 'none' | 'words';
  keyboardType?: 'default' | 'email-address';
  secure?: boolean;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
};

export function AccountField(props: Props) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const labelId = `${props.name}-label`;
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.labelRow}>
        <Text nativeID={labelId} style={[styles.label, { color: colors.text }]}>{props.label}</Text>
        {props.hint ? <Text style={[styles.hint, { color: colors.muted }]}>{props.hint}</Text> : null}
      </View>
      <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: props.error ? '#DC2626' : colors.border }]}>
        <TextInput
          accessibilityLabel={props.label}
          accessibilityHint={props.error || props.hint}
          aria-invalid={!!props.error}
          aria-labelledby={labelId}
          autoCapitalize={props.autoCapitalize ?? 'none'}
          autoCorrect={false}
          spellCheck={false}
          autoComplete={props.name === 'name' ? 'name' : props.name === 'email' ? 'email' : props.name === 'password' ? (props.isRegister ? 'new-password' : 'current-password') : 'new-password'}
          keyboardType={props.keyboardType ?? 'default'}
          onChangeText={props.onChangeText}
          onSubmitEditing={props.onSubmitEditing}
          returnKeyType={props.name === 'confirmPassword' || (!props.isRegister && props.name === 'password') ? 'go' : 'next'}
          secureTextEntry={props.secure && !visible}
          style={[styles.input, { color: colors.text }]}
          textContentType={props.name === 'name' ? 'name' : props.name === 'email' ? 'emailAddress' : props.name === 'password' ? (props.isRegister ? 'newPassword' : 'password') : 'newPassword'}
          value={props.value}
        />
        {props.secure ? <Pressable accessibilityRole="button" accessibilityLabel={visible ? `Hide ${props.label.toLowerCase()}` : `Show ${props.label.toLowerCase()}`} onPress={() => setVisible((current) => !current)} hitSlop={10} style={styles.showButton}><Text style={[styles.showText, { color: colors.muted }]}>{visible ? 'Hide' : 'Show'}</Text></Pressable> : null}
      </View>
      {props.error ? <Text accessibilityRole="alert" style={styles.errorText}>{props.error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldGroup: { gap: 7 }, labelRow: { minHeight: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '500' }, hint: { fontSize: 12 },
  inputWrap: { minHeight: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minHeight: 46, fontSize: 15, paddingVertical: 10 },
  showButton: { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }, showText: { fontSize: 13, fontWeight: '600' },
  errorText: { color: '#B42318', fontSize: 13, lineHeight: 18 },
});
