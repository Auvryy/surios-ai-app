import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/screen';
import { useTheme } from '@/constants/theme';

const steps = [
  ['01', 'Document the issue', 'Capture clear evidence of a public infrastructure defect.'],
  ['02', 'Locate and assess', 'Pin the location and request an evidence-grounded AI assessment.'],
  ['03', 'Follow the response', 'Track official progress and the evidence behind a resolution.'],
];

export default function HomeScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <View style={{ gap: 16, paddingTop: 16 }}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>COMMUNITY INFRASTRUCTURE</Text>
        <Text role="heading" style={[styles.title, { color: colors.text }]}>Better infrastructure starts with a closer look.</Text>
        <Text style={[styles.body, { color: colors.muted }]}>A mobile companion for documenting local issues and following accountable public responses.</Text>
      </View>
      <View style={[styles.notice, { backgroundColor: colors.accent }]}>
        <Text style={[styles.label, { color: colors.primary }]}>Mobile foundation</Text>
        <Text style={[styles.body, { color: colors.text }]}>This is the initial app setup. Sign-in, reports, the hazard map, and Azure integration are coming next.</Text>
      </View>
      <View style={{ gap: 20 }}>
        <Text role="heading" style={[styles.sectionTitle, { color: colors.text }]}>The reporting journey</Text>
        {steps.map(([number, title, description]) => (
          <View key={number} style={styles.row}>
            <Text style={[styles.number, { color: colors.primary }]}>{number}</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.label, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.body, { color: colors.muted }]}>{description}</Text>
            </View>
          </View>
        ))}
      </View>
      <Link href="/about" asChild>
        <Pressable accessibilityRole="link" style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}>
          <Text style={[styles.label, { color: colors.onPrimary }]}>What SuriOS is about</Text>
        </Pressable>
      </Link>
    </Screen>
  );
}
const styles = StyleSheet.create({
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontSize: 36, lineHeight: 43, fontWeight: '700', letterSpacing: -1 },
  sectionTitle: { fontSize: 21, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 25 },
  label: { fontSize: 16, fontWeight: '600', lineHeight: 24 },
  notice: { borderRadius: 16, padding: 20, gap: 8 },
  row: { flexDirection: 'row', gap: 16 },
  number: { fontSize: 16, fontWeight: '700', lineHeight: 24 },
  button: { minHeight: 52, borderRadius: 12, padding: 16, alignItems: 'center', justifyContent: 'center' },
});
