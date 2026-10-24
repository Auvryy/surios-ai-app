import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from '@/components/auth/brand-mark';
import { CitizenTabBar, type CitizenSection } from '@/components/citizen/citizen-tab-bar';
import { ReportComposer } from '@/components/citizen/report-composer';
import { useTheme } from '@/constants/theme';

const infrastructureTypes = ['Roads', 'Bridges', 'Drainage', 'Streetlights', 'Water lines', 'Telecom'];

export default function CitizenScreen() {
  const { colors } = useTheme();
  const [section, setSection] = useState<CitizenSection>('feed');
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.shell, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <View style={styles.header}>
              <View>
                <BrandMark />
                <Text style={[styles.brandCaption, { color: colors.muted }]}>COMMUNITY INFRASTRUCTURE</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open updates"
                onPress={() => setSection('updates')}
                style={({ pressed }) => [styles.notificationButton, { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.75 : 1 }]}
              >
                <Feather name="bell" size={20} color={colors.text} />
              </Pressable>
            </View>

            <Pressable accessibilityRole="button" accessibilityLabel="View the Santa Cruz hazard map" onPress={() => setSection('map')} style={({ pressed }) => [styles.locationChip, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.78 : 1 }]}>
              <View style={[styles.locationIcon, { backgroundColor: colors.accent }]}><Feather name="map-pin" size={15} color={colors.primary} /></View>
              <Text style={[styles.locationText, { color: colors.text }]}>Santa Cruz, Laguna</Text>
              <Feather name="chevron-down" size={16} color={colors.muted} />
            </Pressable>

            {section === 'feed' && <FeedSection onCreate={() => setComposerOpen(true)} />}
            {section === 'map' && <MapSection onCreate={() => setComposerOpen(true)} />}
            {section === 'updates' && <UpdatesSection />}
            {section === 'profile' && <ProfileSection onSignIn={() => router.push('/login')} />}
          </View>
        </ScrollView>

        <CitizenTabBar active={section} onChange={setSection} onCreate={() => setComposerOpen(true)} />
        <ReportComposer visible={composerOpen} onClose={() => setComposerOpen(false)} />
      </View>
    </SafeAreaView>
  );
}

function FeedSection({ onCreate }: { onCreate: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.headingBlock}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR COMMUNITY</Text>
        <Text accessibilityRole="header" style={[styles.pageTitle, { color: colors.text }]}>Community feed</Text>
        <Text style={[styles.body, { color: colors.muted }]}>Infrastructure reports and official updates from your area.</Text>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Start a community infrastructure report" onPress={onCreate} style={({ pressed }) => [styles.composerCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.82 : 1 }]}>
        <View style={[styles.composerIcon, { backgroundColor: colors.accent }]}><Feather name="camera" size={21} color={colors.primary} /></View>
        <View style={styles.composerCopy}>
          <Text style={[styles.composerTitle, { color: colors.text }]}>See something that needs attention?</Text>
          <Text style={[styles.composerBody, { color: colors.muted }]}>Start a post with a photo and a map pin.</Text>
        </View>
        <Feather name="arrow-up-right" size={19} color={colors.primary} />
      </Pressable>

      <View style={styles.sectionHeadingRow}>
        <View style={styles.sectionTitleBlock}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Community updates</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>Reports and public responses</Text>
        </View>
        <View style={[styles.previewBadge, { backgroundColor: colors.accent }]}><Text style={[styles.previewText, { color: colors.primary }]}>PREVIEW</Text></View>
      </View>

      <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MapIllustration />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Your local feed starts here</Text>
        <Text style={[styles.emptyBody, { color: colors.muted }]}>The mobile preview is not connected to live posts yet. Once connected, you’ll see community reports and official updates here.</Text>
        <Pressable accessibilityRole="button" onPress={onCreate} style={({ pressed }) => [styles.emptyButton, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}>
          <Feather name="plus" size={18} color={colors.onPrimary} />
          <Text style={[styles.emptyButtonText, { color: colors.onPrimary }]}>Start a report</Text>
        </Pressable>
      </View>

      <View style={styles.typesBlock}>
        <Text style={[styles.typesTitle, { color: colors.text }]}>Infrastructure we cover</Text>
        <View style={styles.typeChips}>
          {infrastructureTypes.map((label) => <View key={label} style={[styles.typeChip, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.typeText, { color: colors.muted }]}>{label}</Text></View>)}
        </View>
      </View>

      <PreviewNote />
    </View>
  );
}

function MapSection({ onCreate }: { onCreate: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.headingBlock}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>EXPLORE YOUR AREA</Text>
        <Text accessibilityRole="header" style={[styles.pageTitle, { color: colors.text }]}>Hazard map</Text>
        <Text style={[styles.body, { color: colors.muted }]}>Find public infrastructure reports around Santa Cruz.</Text>
      </View>
      <View style={[styles.mapCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MapIllustration large />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Map preview</Text>
        <Text style={[styles.emptyBody, { color: colors.muted }]}>The live street map and report pins will appear here after the mobile app connects to SuriOS.</Text>
        <View style={[styles.mapLegend, { backgroundColor: colors.accent }]}>
          <Feather name="map-pin" size={15} color={colors.primary} />
          <Text style={[styles.legendText, { color: colors.text }]}>Report locations</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onCreate} style={({ pressed }) => [styles.emptyButton, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}>
          <Feather name="camera" size={17} color={colors.onPrimary} />
          <Text style={[styles.emptyButtonText, { color: colors.onPrimary }]}>Create a report</Text>
        </Pressable>
      </View>
      <PreviewNote />
    </View>
  );
}

function UpdatesSection() {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.headingBlock}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>STAY IN THE LOOP</Text>
        <Text accessibilityRole="header" style={[styles.pageTitle, { color: colors.text }]}>Your updates</Text>
        <Text style={[styles.body, { color: colors.muted }]}>Follow conversations and see progress from local offices.</Text>
      </View>
      <EmptySectionCard icon="bell" title="No updates yet" body="Replies, official progress notes and resolution evidence will appear here when the feed is connected." />
      <PreviewNote />
    </View>
  );
}

function ProfileSection({ onSignIn }: { onSignIn: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.headingBlock}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR SPACE</Text>
        <Text accessibilityRole="header" style={[styles.pageTitle, { color: colors.text }]}>Profile</Text>
        <Text style={[styles.body, { color: colors.muted }]}>Manage your account and the reports you share.</Text>
      </View>
      <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.profileIcon, { backgroundColor: colors.accent }]}><Feather name="user" size={24} color={colors.primary} /></View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Sign in to your account</Text>
        <Text style={[styles.emptyBody, { color: colors.muted }]}>Account access is not connected in this mobile preview yet.</Text>
        <Pressable accessibilityRole="button" onPress={onSignIn} style={({ pressed }) => [styles.emptyButton, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}>
          <Text style={[styles.emptyButtonText, { color: colors.onPrimary }]}>Open sign in</Text>
          <Feather name="arrow-right" size={17} color={colors.onPrimary} />
        </Pressable>
      </View>
      <PreviewNote />
    </View>
  );
}

function EmptySectionCard({ icon, title, body }: { icon: 'bell' | 'message-circle'; title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.profileIcon, { backgroundColor: colors.accent }]}><Feather name={icon} size={22} color={colors.primary} /></View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.muted }]}>{body}</Text>
    </View>
  );
}

function PreviewNote() {
  const { colors } = useTheme();
  return (
    <View style={[styles.previewNote, { borderColor: colors.border }]}>
      <Feather name="info" size={15} color={colors.muted} />
      <Text style={[styles.previewNoteText, { color: colors.muted }]}>Preview only · Live posts, maps and account data are not connected yet.</Text>
    </View>
  );
}

function MapIllustration({ large = false }: { large?: boolean }) {
  const { colors } = useTheme();
  return (
    <View accessibilityElementsHidden style={[styles.mapIllustration, large && styles.mapIllustrationLarge, { backgroundColor: colors.accent }]}>
      <View style={[styles.street, styles.streetOne, { backgroundColor: colors.surface }]} />
      <View style={[styles.street, styles.streetTwo, { backgroundColor: colors.surface }]} />
      <View style={[styles.street, styles.streetThree, { backgroundColor: colors.surface }]} />
      <View style={[styles.street, styles.streetFour, { backgroundColor: colors.surface }]} />
      <View style={[styles.mapPin, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
        <Feather name="map-pin" size={large ? 25 : 22} color={colors.onPrimary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  shell: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
  content: { gap: 20 },
  header: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandCaption: { marginTop: 3, marginLeft: 46, fontSize: 10, lineHeight: 14, letterSpacing: 0.55, fontWeight: '600' },
  notificationButton: { width: 46, height: 46, borderWidth: 1, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  locationChip: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 22, paddingHorizontal: 8, paddingRight: 12 },
  locationIcon: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  locationText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  section: { gap: 19, paddingTop: 3 },
  headingBlock: { gap: 6 },
  eyebrow: { fontSize: 11, lineHeight: 16, letterSpacing: 1.1, fontWeight: '700' },
  pageTitle: { fontSize: 28, lineHeight: 35, fontWeight: '700', letterSpacing: -0.55 },
  body: { fontSize: 15, lineHeight: 22 },
  composerCard: { minHeight: 94, borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  composerIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  composerCopy: { flex: 1, gap: 3 },
  composerTitle: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  composerBody: { fontSize: 13, lineHeight: 18 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitleBlock: { flex: 1, gap: 2 },
  sectionTitle: { fontSize: 19, lineHeight: 26, fontWeight: '700', letterSpacing: -0.2 },
  sectionSubtitle: { fontSize: 13, lineHeight: 18 },
  previewBadge: { paddingHorizontal: 9, minHeight: 25, borderRadius: 13, justifyContent: 'center' },
  previewText: { fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 0.6 },
  emptyCard: { alignItems: 'center', borderWidth: 1, borderRadius: 18, padding: 20, gap: 10 },
  mapIllustration: { width: 88, height: 80, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  mapIllustrationLarge: { width: '100%', height: 190, marginBottom: 5 },
  street: { position: 'absolute', height: 9, width: '120%', borderRadius: 8 },
  streetOne: { transform: [{ rotate: '-28deg' }], top: 22, left: -13 },
  streetTwo: { transform: [{ rotate: '35deg' }], top: 47, left: -10 },
  streetThree: { transform: [{ rotate: '82deg' }], top: 36, left: 15, width: '85%' },
  streetFour: { transform: [{ rotate: '-72deg' }], top: 36, right: 5, width: '80%' },
  mapPin: { width: 42, height: 42, borderRadius: 22, borderWidth: 3, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#542000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4 },
  emptyTitle: { fontSize: 17, lineHeight: 23, fontWeight: '700', textAlign: 'center' },
  emptyBody: { maxWidth: 360, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  emptyButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 16, marginTop: 2 },
  emptyButtonText: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  typesBlock: { gap: 10 },
  typesTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  typeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { minHeight: 33, justifyContent: 'center', borderWidth: 1, borderRadius: 18, paddingHorizontal: 12 },
  typeText: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  mapCard: { alignItems: 'center', borderWidth: 1, borderRadius: 18, padding: 14, gap: 11 },
  mapLegend: { alignSelf: 'stretch', minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10 },
  legendText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  profileCard: { alignItems: 'center', borderWidth: 1, borderRadius: 18, padding: 22, gap: 11 },
  profileIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  previewNote: { minHeight: 40, borderTopWidth: 1, paddingTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  previewNoteText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
