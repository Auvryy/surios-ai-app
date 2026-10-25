import { Text, View } from "react-native";
import { useTheme } from "@/constants/theme";
import { humanize, type Analysis } from "@/lib/report-contracts";
import { Chip, ui } from "@/components/ui/controls";
export function AssessmentDetails({ analysis }: { analysis: Analysis }) {
  const { colors } = useTheme();
  const e = analysis.severityEvidence;
  return (
    <View style={ui.gap}>
      <View style={ui.row}>
        <Chip tone="orange">{humanize(analysis.infrastructureType)}</Chip>
        <Chip tone={analysis.hazardSeverity >= 8 ? "critical" : "neutral"}>
          Severity {analysis.hazardSeverity}/10
        </Chip>
        <Chip>{humanize(analysis.distressType)}</Chip>
      </View>
      <Text style={[ui.body, { color: colors.text }]}>{analysis.summary}</Text>
      {e && (
        <>
          <View style={ui.group}>
            <Text style={[ui.label, { color: colors.text }]}>
              Visible evidence
            </Text>
            {e.visibleDefects.length ? (
              e.visibleDefects.map((line, i) => (
                <Text key={i} style={[ui.body, { color: colors.muted }]}>
                  • {line}
                </Text>
              ))
            ) : (
              <Text style={[ui.body, { color: colors.muted }]}>
                No specific visible defect was established.
              </Text>
            )}
          </View>
          {!!e.reportedConditions.length && (
            <View style={ui.group}>
              <Text style={[ui.label, { color: colors.text }]}>
                Reporter context
              </Text>
              {e.reportedConditions.map((line, i) => (
                <Text key={i} style={[ui.body, { color: colors.muted }]}>
                  • {line}
                </Text>
              ))}
              <Text style={[ui.caption, { color: colors.muted }]}>
                Reported claims are context, not visual proof.
              </Text>
            </View>
          )}
          <Text style={[ui.caption, { color: colors.muted }]}>
            Confidence: {humanize(e.confidence)}
            {e.limitations ? ` · ${e.limitations}` : ""}
          </Text>
        </>
      )}
      {!!analysis.recommendedAction && (
        <View style={ui.group}>
          <Text style={[ui.label, { color: colors.text }]}>
            Suggested response
          </Text>
          <Text style={[ui.body, { color: colors.muted }]}>
            {analysis.recommendedAction}
          </Text>
        </View>
      )}
      <Text style={[ui.caption, { color: colors.muted }]}>
        AI estimates need on-site verification. Support affects priority, not
        physical severity.
      </Text>
    </View>
  );
}
