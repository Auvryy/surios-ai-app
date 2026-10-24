import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/constants/theme';

type Props = { kind: 'report' | 'locate' | 'follow' };

export function OnboardingArt({ kind }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.canvas, { backgroundColor: colors.accent, borderColor: colors.border }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {kind === 'report' && <View style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.cover, { backgroundColor: colors.accent }]}><View style={[styles.coverSun, { backgroundColor: colors.primary }]} /><View style={[styles.coverRoad, { backgroundColor: colors.surface }]} /><View style={[styles.coverMark, { backgroundColor: colors.primary }]} /></View>
        <View style={[styles.line, { backgroundColor: colors.text, width: '72%' }]} />
        <View style={[styles.line, { backgroundColor: colors.border, width: '48%' }]} />
        <View style={styles.chips}><View style={[styles.chip, { backgroundColor: colors.accent }]} /><View style={[styles.chip, { backgroundColor: colors.border, width: 54 }]} /></View>
      </View>}
      {kind === 'locate' && <View style={[styles.mapCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.mapRoad, styles.roadOne, { backgroundColor: colors.border }]} /><View style={[styles.mapRoad, styles.roadTwo, { backgroundColor: colors.border }]} /><View style={[styles.mapRoad, styles.roadThree, { backgroundColor: colors.border }]} />
        <View style={[styles.pin, { backgroundColor: colors.primary, borderColor: colors.surface }]}><View style={[styles.pinCenter, { backgroundColor: colors.surface }]} /></View>
        <View style={[styles.mapLabel, { backgroundColor: colors.surface }]}><View style={[styles.mapDot, { backgroundColor: colors.primary }]} /><View style={{ gap: 5 }}><View style={[styles.line, { backgroundColor: colors.text, width: 90 }]} /><View style={[styles.line, { backgroundColor: colors.border, width: 62 }]} /></View></View>
      </View>}
      {kind === 'follow' && <View style={[styles.updateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.updateTop}><View style={[styles.avatar, { backgroundColor: colors.accent }]} /><View style={{ flex: 1, gap: 5 }}><View style={[styles.line, { backgroundColor: colors.text, width: '58%' }]} /><View style={[styles.line, { backgroundColor: colors.border, width: '36%' }]} /></View><View style={[styles.status, { backgroundColor: colors.accent }]}><Text style={[styles.statusText, { color: colors.primary }]}>IN PROGRESS</Text></View></View>
        <View style={[styles.updateImage, { backgroundColor: colors.accent }]}><View style={[styles.updateImageRoad, { backgroundColor: colors.primary }]} /></View>
        <View style={styles.timeline}><View style={[styles.timelineDot, { backgroundColor: colors.primary }]} /><View style={[styles.timelineLine, { backgroundColor: colors.border }]} /><Text style={[styles.timelineText, { color: colors.muted }]}>Official update posted</Text></View>
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { height: 250, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  reportCard: { width: '72%', borderWidth: 1, borderRadius: 16, padding: 12, gap: 10, transform: [{ rotate: '-3deg' }] },
  cover: { height: 112, borderRadius: 10, overflow: 'hidden', justifyContent: 'flex-end' },
  coverSun: { position: 'absolute', width: 27, height: 27, borderRadius: 14, top: 16, right: 22 },
  coverRoad: { height: 34, transform: [{ rotate: '-10deg' }], marginHorizontal: -12, marginBottom: 7 },
  coverMark: { position: 'absolute', width: 13, height: 13, borderRadius: 7, bottom: 25, left: '54%', borderWidth: 2, borderColor: '#fff' },
  line: { height: 8, borderRadius: 5 },
  chips: { flexDirection: 'row', gap: 7 },
  chip: { width: 68, height: 17, borderRadius: 8 },
  mapCard: { width: '78%', height: 168, borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  mapRoad: { position: 'absolute', height: 11, borderRadius: 6 },
  roadOne: { width: '120%', top: 50, left: -22, transform: [{ rotate: '-22deg' }] },
  roadTwo: { width: '95%', top: 104, right: -18, transform: [{ rotate: '18deg' }] },
  roadThree: { width: '72%', top: 31, right: -48, transform: [{ rotate: '70deg' }] },
  pin: { position: 'absolute', width: 31, height: 31, borderRadius: 18, top: 42, left: '51%', borderWidth: 4, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }] },
  pinCenter: { width: 6, height: 6, borderRadius: 3 },
  mapLabel: { position: 'absolute', bottom: 12, left: 12, right: 12, borderRadius: 11, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mapDot: { width: 10, height: 10, borderRadius: 5 },
  updateCard: { width: '82%', borderWidth: 1, borderRadius: 16, padding: 13, gap: 12, transform: [{ rotate: '2deg' }] },
  updateTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 30, height: 30, borderRadius: 15 },
  status: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5 },
  statusText: { fontSize: 8, fontWeight: '800', letterSpacing: 0.4 },
  updateImage: { height: 85, borderRadius: 10, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  updateImageRoad: { width: '120%', height: 19, transform: [{ rotate: '-11deg' }] },
  timeline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: { width: 34, height: 1 },
  timelineText: { fontSize: 12, fontWeight: '500' },
});
