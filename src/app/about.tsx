import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/screen";
import { useTheme } from "@/constants/theme";

const assets = [
  "Road pavement",
  "Bridges and footbridges",
  "Drainage and flood canals",
  "Streetlights and utility poles",
  "Water pipes and hydrants",
  "Telecom and fiber cables",
];
export default function AboutScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <Text role="heading" style={[styles.title, { color: colors.text }]}>
        Inspect. Report. Follow through.
      </Text>
      <Text style={[styles.body, { color: colors.muted }]}>
        SuriOS takes its name from the Tagalog word suri: to inspect and
        analyze. It connects community evidence with public infrastructure
        responses, starting in Santa Cruz, Laguna.
      </Text>
      <View style={{ gap: 12 }}>
        <Text role="heading" style={[styles.heading, { color: colors.text }]}>
          Infrastructure beyond roads
        </Text>
        {assets.map((asset) => (
          <View
            key={asset}
            style={[
              styles.asset,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Text style={[styles.body, { color: colors.text }]}>{asset}</Text>
          </View>
        ))}
      </View>
      <View style={{ gap: 8 }}>
        <Text role="heading" style={[styles.heading, { color: colors.text }]}>
          Built around SDG 9
        </Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          Documenting defects and tracking repairs supports resilient
          infrastructure. Reporting damaged telecom assets also relates to SDG
          target 9.c on information and communications technology.
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text role="heading" style={[styles.heading, { color: colors.text }]}>
          AI supports human judgment
        </Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          Mobile reports use the existing server-side assessment. AI separates
          visible evidence from unverified claims; qualified on-site inspection
          confirms conditions and repairs.
        </Text>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  title: { fontSize: 30, lineHeight: 38, fontWeight: "700" },
  heading: { fontSize: 21, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 25 },
  asset: { padding: 16, borderWidth: 1, borderRadius: 12 },
});
