import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/constants/theme';

export function BrandMark() {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessible accessibilityLabel="SuriOS">
      <View style={[styles.mark, { backgroundColor: colors.primary }]}><Text style={[styles.initial, { color: colors.onPrimary }]}>S</Text></View>
      <Text style={[styles.name, { color: colors.text }]}>SuriOS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 20, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
});
