import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/theme';

export type CitizenSection = 'feed' | 'map' | 'updates' | 'profile';

const items = [
  { key: 'feed', label: 'Home', icon: 'home' },
  { key: 'map', label: 'Map', icon: 'map' },
  { key: 'updates', label: 'Updates', icon: 'bell' },
  { key: 'profile', label: 'Profile', icon: 'user' },
] as const;

type Props = {
  active: CitizenSection;
  onChange: (section: CitizenSection) => void;
  onCreate: () => void;
};

export function CitizenTabBar({ active, onChange, onCreate }: Props) {
  const { colors } = useTheme();

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safe, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      <View style={styles.row}>
        {items.slice(0, 2).map((item) => <TabItem key={item.key} item={item} active={active === item.key} onPress={() => onChange(item.key)} />)}
        <View style={styles.createSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a report"
            onPress={onCreate}
            style={({ pressed }) => [styles.createButton, { backgroundColor: colors.primary, opacity: pressed ? 0.84 : 1 }]}
          >
            <Feather name="camera" size={22} color={colors.onPrimary} />
          </Pressable>
          <Text style={[styles.createLabel, { color: colors.primary }]}>Post</Text>
        </View>
        {items.slice(2).map((item) => <TabItem key={item.key} item={item} active={active === item.key} onPress={() => onChange(item.key)} />)}
      </View>
    </SafeAreaView>
  );
}

type Item = (typeof items)[number];

function TabItem({ item, active, onPress }: { item: Item; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.item, { opacity: pressed ? 0.72 : 1 }]}
    >
      <View style={[styles.iconWrap, active && { backgroundColor: colors.accent }]}>
        <Feather name={item.icon} size={20} color={active ? colors.primary : colors.muted} />
      </View>
      <Text numberOfLines={1} style={[styles.label, { color: active ? colors.primary : colors.muted, fontWeight: active ? '700' : '500' }]}>{item.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { width: '100%', maxWidth: 520, alignSelf: 'center', borderTopWidth: 1 },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 6, columnGap: 4 },
  item: { flex: 1, minWidth: 0, minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 3 },
  iconWrap: { minWidth: 38, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  label: { fontSize: 12, lineHeight: 16 },
  createSlot: { flex: 1, minWidth: 58, minHeight: 68, alignItems: 'center', justifyContent: 'flex-start' },
  createButton: { width: 58, height: 58, marginTop: -18, borderRadius: 29, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#542000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 5 },
  createLabel: { marginTop: -1, fontSize: 12, lineHeight: 16, fontWeight: '700' },
});
