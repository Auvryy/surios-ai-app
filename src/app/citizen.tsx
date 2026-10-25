import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { FeedComposer } from "@/components/citizen/feed-composer";
import { HazardMap } from "@/components/map/hazard-map";
import { Button, Notice, ui } from "@/components/ui/controls";
import type { PublishedReport } from "@/lib/report-contracts";
import type { Coordinate } from "@/lib/roads";
import type { Attachment } from "@/reporting/contracts";
import { NotificationInbox } from "@/components/notifications/notification-inbox";
import { useNotifications } from "@/components/notifications/notification-provider";
import { unreadLabel } from "@/lib/notifications";
import { ProfileScreen } from "@/components/profile/profile-screen";
import { PublicProfileScreen } from "@/components/profile/public-profile-screen";
import { defaultFeedQuery, feedRequest, normalizeFeedQuery, type FeedQuery } from "@/lib/feed-filters";

export default function CitizenScreen({ initialSection = "feed" }: { initialSection?: CitizenSection }) {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ profile?: string | string[] }>();
  const viewedProfileId = typeof params.profile === "string" ? params.profile.toLowerCase() : "";
  const viewingContributor = params.profile !== undefined;
  const { unreadCount } = useNotifications();
  const [section, setSection] = useState<CitizenSection>(initialSection);
  const [composerOpen, setComposerOpen] = useState(false);
  const [initialPoint, setInitialPoint] = useState<Coordinate | undefined>();
  const [initialAttachments, setInitialAttachments] = useState<Attachment[]>([]);
  const [feedVersion, setFeedVersion] = useState(0);
  const [feedQuery, setFeedQuery] = useState<FeedQuery>(defaultFeedQuery);
  const changeQuery = (input: FeedQuery) => {
    const next = normalizeFeedQuery(input);
    setFeedQuery((previous) => feedRequest(previous) === feedRequest(next) ? previous : next);
  };
  const [published, setPublished] = useState<PublishedReport | null>(null);
  const [mapReportId, setMapReportId] = useState<string | undefined>();
  const create = (point?: Coordinate, attachments: Attachment[] = []) => {
    setInitialPoint(point);
    setInitialAttachments(attachments);
    setComposerOpen(true);
  };
  const openMap = (id?: string) => {
    setMapReportId(id);
    setSection("map");
  };
  const onPublished = (result: PublishedReport) => {
    setPublished(result);
    setComposerOpen(false);
    setInitialAttachments([]);
    setFeedVersion((v) => v + 1);
    setFeedQuery(defaultFeedQuery);
    if (viewingContributor) router.setParams({ profile: undefined });
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
    </View>
  );

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <View style={[styles.shell, { backgroundColor: colors.background }]}>
        {section === "feed" ? viewingContributor ? (
          <PublicProfileScreen key={viewedProfileId} id={viewedProfileId} header={header} onMap={openMap}
            onBack={() => { if (router.canGoBack()) router.back(); else router.setParams({ profile: undefined }); }}
            onOwnProfile={() => { router.setParams({ profile: undefined }); setSection("profile"); }} />
        ) : (
          <CommunityFeed key={feedVersion} header={header} composer={<FeedComposer onCreate={(files) => create(undefined, files)} />} onMap={openMap} query={feedQuery} onQueryChange={changeQuery} />
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
            if (next === "feed" && viewingContributor) router.setParams({ profile: undefined });
            if (next === "map") setMapReportId(undefined);
            setSection(next);
          }}
          onCreate={() => create()}
        />
        {composerOpen && (
          <ReportComposer
            onClose={() => { setComposerOpen(false); setInitialAttachments([]); }}
            onPublished={onPublished}
            initialPoint={initialPoint}
            initialAttachments={initialAttachments}
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

const styles = StyleSheet.create({
  unreadBadge: { position: "absolute", top: -3, right: -5, minWidth: 20, minHeight: 20, borderRadius: 12, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  unreadBadgeText: { fontSize: 10, lineHeight: 15, fontWeight: "700" },
  safe: { flex: 1 },
  shell: { flex: 1, width: "100%", maxWidth: 520, alignSelf: "center" },
  content: { gap: 12 },
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
});
