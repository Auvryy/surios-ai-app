import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/theme';

type Props = { visible: boolean; onClose: () => void };

export function ReportComposer({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const [description, setDescription] = useState('');
  const [notice, setNotice] = useState('This preview stays on your device. Nothing is uploaded or published.');

  const explainUnavailable = (feature: 'photos' | 'location') => {
    setNotice(feature === 'photos'
      ? 'Photo capture and uploads will be connected in the reporting phase. No image was selected.'
      : 'Location selection will be connected in the reporting phase. No location was recorded.');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={[styles.eyebrow, { color: colors.primary }]}>COMMUNITY REPORT</Text>
                <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Start a post</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close report composer" onPress={onClose} hitSlop={8} style={[styles.closeButton, { backgroundColor: colors.background }]}>
                <Feather name="x" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
              <Text style={[styles.intro, { color: colors.muted }]}>Describe a public infrastructure concern. You can add photos and a map pin when reporting tools are connected.</Text>

              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>What needs attention?</Text>
                  <Text style={[styles.counter, { color: colors.muted }]}>{description.length}/600</Text>
                </View>
                <TextInput
                  accessibilityLabel="Report description"
                  accessibilityHint="Describe what you can see. Do not include private or sensitive information."
                  value={description}
                  onChangeText={setDescription}
                  maxLength={600}
                  multiline
                  placeholder="Share what you noticed and where it is."
                  placeholderTextColor={colors.muted}
                  selectionColor={colors.primary}
                  textAlignVertical="top"
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                />
              </View>

              <View style={styles.actions}>
                <ActionButton icon="camera" label="Add photos" helper="Photo upload not connected" onPress={() => explainUnavailable('photos')} />
                <ActionButton icon="map-pin" label="Add location" helper="Map selection not connected" onPress={() => explainUnavailable('location')} />
              </View>

              <View accessibilityRole="alert" style={[styles.notice, { backgroundColor: colors.accent, borderColor: colors.border }]}>
                <Feather name="info" size={17} color={colors.primary} />
                <Text style={[styles.noticeText, { color: colors.text }]}>{notice}</Text>
              </View>
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <Text style={[styles.footerHint, { color: colors.muted }]}>Publishing is not connected yet.</Text>
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: true }} disabled style={[styles.publishButton, { backgroundColor: colors.border }]}>
                <Text style={[styles.publishText, { color: colors.muted }]}>Publish report</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function ActionButton({ icon, label, helper, onPress }: { icon: 'camera' | 'map-pin'; label: string; helper: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}. ${helper}`} onPress={onPress} style={({ pressed }) => [styles.action, { borderColor: colors.border, backgroundColor: pressed ? colors.accent : colors.surface }]}>
      <View style={[styles.actionIcon, { backgroundColor: colors.accent }]}><Feather name={icon} size={18} color={colors.primary} /></View>
      <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
      <Text numberOfLines={2} style={[styles.actionHelper, { color: colors.muted }]}>{helper}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24, 24, 27, 0.42)' },
  keyboard: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 520, maxHeight: '94%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCopy: { gap: 3 },
  eyebrow: { fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 1.1 },
  title: { fontSize: 23, lineHeight: 30, fontWeight: '700', letterSpacing: -0.35 },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingBottom: 18, gap: 18 },
  intro: { fontSize: 15, lineHeight: 22 },
  fieldGroup: { gap: 8 },
  fieldLabelRow: { minHeight: 23, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  counter: { fontSize: 12, lineHeight: 18 },
  input: { minHeight: 126, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, fontSize: 16, lineHeight: 23 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, minHeight: 112, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: 'flex-start', justifyContent: 'center', gap: 4 },
  actionIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  actionLabel: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  actionHelper: { width: '100%', fontSize: 12, lineHeight: 16 },
  notice: { minHeight: 54, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  footer: { borderTopWidth: 1, paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  footerHint: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  publishButton: { minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  publishText: { fontSize: 15, fontWeight: '700' },
});
