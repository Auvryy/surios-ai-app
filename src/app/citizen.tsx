import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandMark } from "@/components/auth/brand-mark";
import {
  CitizenTabBar,
  type CitizenSection,
} from "@/components/citizen/citizen-tab-bar";
import { ReportComposer } from "@/components/citizen/report-composer";
import { useTheme } from "@/constants/theme";
import { useSession } from "@/auth/session-provider";
import { SessionPanel } from "@/components/auth/session-panel";
import { CommunityFeed } from "@/components/citizen/community-feed";
import { HazardMap } from "@/components/map/hazard-map";
import { Button, Notice, ui } from "@/components/ui/controls";
import type { PublishedReport } from "@/lib/report-contracts";
import type { Coordinate } from "@/lib/roads";
import { NotificationInbox } from "@/components/notifications/notification-inbox";
import { useNotifications } from "@/components/notifications/notification-provider";
import { unreadLabel } from "@/lib/notifications";
import { ProfileScreen } from "@/components/profile/profile-screen";

const infrastructureTypes = [
  "Roads",
  "Bridges",
  "Drainage",
  "Streetlights",
  "Water lines",
  "Telecom",
];

export default function CitizenScreen({ initialSection = "feed" }: { initialSection?: CitizenSection }) {
  const { colors } = useTheme();
  const { unreadCount } = useNotifications();
  const [section, setSection] = useState<CitizenSection>(initialSection);
  const [composerOpen, setComposerOpen] = useState(false);
  const [initialPoint, setInitialPoint] = useState<Coordinate | undefined>();
  const [feedVersion, setFeedVersion] = useState(0);
  const [published, setPublished] = useState<PublishedReport | null>(null);
  const [mapReportId, setMapReportId] = useState<string | undefined>();
  const create = (point?: Coordinate) => {
    setInitialPoint(point);
    setComposerOpen(true);
  };
  const openMap = (id?: string) => {
    setMapReportId(id);
    setSection("map");
  };
  const onPublished = (result: PublishedReport) => {
    setPublished(result);
    setComposerOpen(false);
    setFeedVersion((v) => v + 1);
    setSection("feed");
  };
  const { session, status } = useSession();

  if (
    status === "loading" ||
    status === "unavailable" ||
    session?.user.accountStatus !== "ACTIVE"
  )
    return <SessionPanel />;

  const header = (
    <View style={styles.content}>
      <CommunityHeader
        onUpdates={() => setSection("updates")}
        onMap={() => openMap()}
        unreadCount={unreadCount}
      />
      {published && (
        <View style={ui.gap}>
          <Notice>
            {published.grouped
              ? "Post published and linked to the existing hazard. Its current status and severity come from that shared issue."
              : "Your report was published."}
          </Notice>
          <Button
            label="View published hazard on map"
            icon="map-pin"
            onPress={() => openMap(published.reportId)}
          />
        </View>
      )}
      {section === "feed" && <FeedSection onCreate={() => create()} />}
    </View>
  );

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <View style={[styles.shell, { backgroundColor: colors.background }]}>
        {section === "feed" ? (
          <CommunityFeed key={feedVersion} header={header} onMap={openMap} />
        ) : section === "profile" ? (
          <ProfileScreen user={session.user} onBack={() => setSection("feed")} onCreate={() => create()} onMap={openMap} onChanged={() => setFeedVersion((v) => v + 1)} />
        ) : section === "map" ? (
          <HazardMap onCreate={create} reportId={mapReportId} />
        ) : (
          <NotificationInbox header={header} />
        )}

        <CitizenTabBar
          active={section}
          unreadCount={unreadCount}
          onChange={(next) => {
            if (next === "map") setMapReportId(undefined);
            setSection(next);
          }}
          onCreate={() => create()}
        />
        {composerOpen && (
          <ReportComposer
            onClose={() => setComposerOpen(false)}
            onPublished={onPublished}
            initialPoint={initialPoint}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function CommunityHeader({
  onUpdates,
  onMap,
  unreadCount,
}: {
  onUpdates: () => void;
  onMap: () => void;
  unreadCount: number | null;
}) {
  const { colors } = useTheme();
  return (
    <>
      <View style={styles.header}>
        <View>
          <BrandMark />
          <Text style={[styles.brandCaption, { color: colors.muted }]}>
            COMMUNITY INFRASTRUCTURE
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open updates"
          accessibilityHint={unreadLabel(unreadCount)}
          onPress={onUpdates}
          style={({ pressed }) => [
            styles.notificationButton,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Feather name="bell" size={20} color={colors.text} />
          {!!unreadCount && <View accessible={false} style={[styles.unreadBadge, { backgroundColor: colors.primary }]}><Text numberOfLines={1} style={[styles.unreadBadgeText, { color: colors.onPrimary }]}>{unreadCount > 99 ? "99+" : unreadCount}</Text></View>}
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View the Santa Cruz hazard map"
        onPress={onMap}
        style={({ pressed }) => [
          styles.locationChip,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.78 : 1,
          },
        ]}
      >
        <View style={[styles.locationIcon, { backgroundColor: colors.accent }]}>
          <Feather name="map-pin" size={15} color={colors.primary} />
        </View>
        <Text style={[styles.locationText, { color: colors.text }]}>
          Santa Cruz, Laguna
        </Text>
        <Feather name="chevron-down" size={16} color={colors.muted} />
      </Pressable>
    </>
  );
}

function FeedSection({ onCreate }: { onCreate: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.headingBlock}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>
          YOUR COMMUNITY
        </Text>
        <Text
          accessibilityRole="header"
          style={[styles.pageTitle, { color: colors.text }]}
        >
          Community feed
        </Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          Infrastructure reports and official updates from your area.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start a community infrastructure report"
        onPress={onCreate}
        style={({ pressed }) => [
          styles.composerCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.82 : 1,
          },
        ]}
      >
        <View style={[styles.composerIcon, { backgroundColor: colors.accent }]}>
          <Feather name="camera" size={21} color={colors.primary} />
        </View>
        <View style={styles.composerCopy}>
          <Text style={[styles.composerTitle, { color: colors.text }]}>
            See something that needs attention?
          </Text>
          <Text style={[styles.composerBody, { color: colors.muted }]}>
            Start a post with a photo and a map pin.
          </Text>
        </View>
        <Feather name="arrow-up-right" size={19} color={colors.primary} />
      </Pressable>

      <View style={styles.sectionHeadingRow}>
        <View style={styles.sectionTitleBlock}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Community updates
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
            Reports and public responses
          </Text>
        </View>
        <View style={[styles.previewBadge, { backgroundColor: colors.accent }]}>
          <Text style={[styles.previewText, { color: colors.primary }]}>
            LIVE
          </Text>
        </View>
      </View>

      <View style={styles.typesBlock}>
        <Text style={[styles.typesTitle, { color: colors.text }]}>
          Infrastructure we cover
        </Text>
        <View style={styles.typeChips}>
          {infrastructureTypes.map((label) => (
            <View
              key={label}
              style={[
                styles.typeChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.typeText, { color: colors.muted }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  unreadBadge: { position: "absolute", top: -3, right: -5, minWidth: 20, minHeight: 20, borderRadius: 12, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  unreadBadgeText: { fontSize: 10, lineHeight: 15, fontWeight: "700" },
  safe: { flex: 1 },
  shell: { flex: 1, width: "100%", maxWidth: 520, alignSelf: "center" },
  scroll: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
  content: { gap: 20 },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandCaption: {
    marginTop: 3,
    marginLeft: 46,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.55,
    fontWeight: "600",
  },
  notificationButton: {
    width: 46,
    height: 46,
    borderWidth: 1,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  locationChip: {
    minHeight: 44,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 8,
    paddingRight: 12,
  },
  locationIcon: {
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  locationText: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  section: { gap: 19, paddingTop: 3 },
  headingBlock: { gap: 6 },
  eyebrow: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.1,
    fontWeight: "700",
  },
  pageTitle: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "700",
    letterSpacing: -0.55,
  },
  body: { fontSize: 15, lineHeight: 22 },
  composerCard: {
    minHeight: 94,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  composerIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  composerCopy: { flex: 1, gap: 3 },
  composerTitle: { fontSize: 14, lineHeight: 19, fontWeight: "600" },
  composerBody: { fontSize: 13, lineHeight: 18 },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitleBlock: { flex: 1, gap: 2 },
  sectionTitle: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  sectionSubtitle: { fontSize: 13, lineHeight: 18 },
  previewBadge: {
    paddingHorizontal: 9,
    minHeight: 25,
    borderRadius: 13,
    justifyContent: "center",
  },
  previewText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  emptyCard: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyBody: {
    maxWidth: 360,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  typesBlock: { gap: 10 },
  typesTitle: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
  typeChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    minHeight: 33,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
  },
  typeText: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
  profileIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  previewNote: {
    minHeight: 40,
    borderTopWidth: 1,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  previewNoteText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
