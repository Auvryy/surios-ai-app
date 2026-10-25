import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, IconButton, Sheet, ui } from "@/components/ui/controls";
import { useTheme } from "@/constants/theme";
import { defaultFeedQuery, normalizeFeedQuery, type FeedQuery } from "@/lib/feed-filters";

export function FeedControls({ query, onChange, total, loading }: {
  query: FeedQuery;
  onChange: (query: FeedQuery) => void;
  total: number | null;
  loading: boolean;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState(query.q);
  const [filters, setFilters] = useState<FeedQuery | null>(null);
  const liked = query.tab === "liked";
  const search = () => {
    const q = text.trim();
    onChange(normalizeFeedQuery({ ...query, q, sort: !query.q && q ? "relevance" : query.sort }));
    Keyboard.dismiss();
  };
  const changed = query.media !== "all" || query.sort !== (query.q ? "relevance" : "newest");
  return (
    <View style={styles.group}>
      {liked && <View style={ui.gap}>
        <Button label="Back to community feed" icon="arrow-left" variant="ghost" onPress={() => onChange(defaultFeedQuery)} />
        <Text accessibilityRole="header" style={[ui.title, { color: colors.text }]}>Liked posts</Text>
        <Text style={[ui.body, { color: colors.muted }]}>Reports and updates you’ve liked.</Text>
      </View>}
      <View style={styles.searchRow}>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Feather accessible={false} name="search" size={19} color={colors.muted} />
          <TextInput accessibilityLabel={liked ? "Search liked posts" : "Search community"}
            placeholder="People, places, and posts" placeholderTextColor={colors.muted}
            value={text} onChangeText={setText} maxLength={100} returnKeyType="search"
            autoCapitalize="none" autoCorrect={false} onSubmitEditing={search}
            style={[styles.input, { color: colors.text }]} selectionColor={colors.primary} />
          {!!text && <IconButton label="Clear search" icon="x" onPress={() => { setText(""); onChange(normalizeFeedQuery({ ...query, q: "" })); }} />}
        </View>
        <IconButton label="Search posts" icon="arrow-right" primary onPress={search} />
      </View>
      {!liked && <View style={styles.tabs}>
        {([{ tab: "all", label: "All updates" }, { tab: "critical", label: "Critical" }, { tab: "liked", label: "Liked posts" }] as const).map((item) =>
          <Button key={item.tab} label={item.label} selected={query.tab === item.tab} compact
            onPress={() => onChange(normalizeFeedQuery({ ...query, tab: item.tab }))} />)}
        <Button label={changed ? "Filters applied" : "Filters"} icon="sliders" compact
          selected={changed} onPress={() => setFilters({ ...query })} />
      </View>}
      <Text accessibilityLiveRegion="polite" style={[ui.caption, { color: colors.muted }]}>
        {loading ? "Loading posts…" : total === null ? "" : `${total} ${total === 1 ? "result" : "results"}${query.q ? ` for “${query.q}”` : ""}`}
      </Text>
      {filters && <Sheet title="Feed filters" onClose={() => setFilters(null)} footer={<>
        <Button label="Apply filters" variant="primary" onPress={() => { onChange(normalizeFeedQuery(filters)); setFilters(null); Keyboard.dismiss(); }} />
        <Button label="Reset filters" onPress={() => setFilters({ ...defaultFeedQuery, q: query.q, sort: query.q ? "relevance" : "newest", tab: query.tab })} />
      </>}>
        <View style={ui.gap} accessibilityRole="radiogroup" accessibilityLabel="Media type">
          <Text style={[ui.heading, { color: colors.text }]}>Media type</Text>
          {([{ value: "all", label: "All media" }, { value: "photo", label: "Photos" }, { value: "video", label: "Videos" }] as const).map((item) =>
            <Choice key={item.value} label={item.label} selected={filters.media === item.value} onPress={() => setFilters({ ...filters, media: item.value })} />)}
        </View>
        <View style={ui.gap} accessibilityRole="radiogroup" accessibilityLabel="Sort posts">
          <Text style={[ui.heading, { color: colors.text }]}>Sort posts</Text>
          {([{ value: "relevance", label: "Most relevant" }, { value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "severity", label: "Highest severity" }, { value: "likes", label: "Most liked" }] as const)
            .filter((item) => item.value !== "relevance" || !!query.q).map((item) =>
              <Choice key={item.value} label={item.label} selected={filters.sort === item.value} onPress={() => setFilters({ ...filters, sort: item.value })} />)}
        </View>
      </Sheet>}
    </View>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected }} aria-checked={selected} onPress={onPress}
    style={({ pressed }) => [styles.choice, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.accent : colors.surface, opacity: pressed ? 0.7 : 1 }]}>
    <Text style={[ui.body, { color: colors.text, flex: 1 }]}>{label}</Text>
    <Feather accessible={false} name={selected ? "check-circle" : "circle"} size={20} color={selected ? colors.primary : colors.muted} />
  </Pressable>;
}

const styles = StyleSheet.create({
  group: { gap: 12 },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  search: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 24, paddingLeft: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, minWidth: 0, minHeight: 48, paddingVertical: 10, fontSize: 15, lineHeight: 22, paddingRight: 4 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { minHeight: 48, borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
});
