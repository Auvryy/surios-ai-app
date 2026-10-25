import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { apiOrigin } from "@/auth/api";
import { useTheme } from "@/constants/theme";
import { publicUrl } from "@/lib/feed";
import type { PostMedia } from "@/lib/report-contracts";
import type { Coordinate, RoadSegment } from "@/lib/roads";
import { StreetMap } from "@/components/map/street-map";
import { EvidencePreview } from "./evidence-preview";

export function PostGallery({ media, coverId, point, roadSegment, title, onMap }: {
  media: PostMedia[];
  coverId: string | null;
  point: Coordinate | null;
  roadSegment: RoadSegment | null;
  title: string;
  onMap?: () => void;
}) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);
  const [failedImage, setFailedImage] = useState("");
  const [mapFailed, setMapFailed] = useState(false);
  const cover = media.find((item) => item.id === coverId);
  const items = cover ? [cover, ...media.filter((item) => item.id !== coverId)] : media;
  const hasMap = !!point;
  const total = items.length + (hasMap ? 1 : 0);
  if (!total) return null;
  const index = Math.min(selected, total - 1);
  const current = items[index];
  const mapSelected = index === items.length;
  const thumbnails = items.map((item, index) => ({ ...item, index })).filter((item) => item.index !== index).slice(0, 2);
  const extra = Math.max(0, items.length - (mapSelected ? 2 : 3));
  const showMap = () => { if (point) setSelected(items.length); else onMap?.(); };
  const open = () => { if (mapSelected) onMap?.(); else setPreview(index); };
  return (
    <>
      <View style={[styles.frame, { backgroundColor: colors.background, borderColor: colors.border }]} testID="post-media-gallery">
        {mapSelected && point ? (
          <View style={StyleSheet.absoluteFill}>
            <StreetMap label={`Location map for ${title}`} state={{ mode: "point", point, section: roadSegment, disabled: true, reducedMotion: true,
              focus: roadSegment ? { key: 1, bounds: roadSegment.coordinates } : { key: 1, point, zoom: 16 } }}
              onEvent={(event) => { if (event.type === "tiles-unavailable") setMapFailed(true); }} />
            {mapFailed && <View pointerEvents="none" style={[styles.fallback, { backgroundColor: colors.surface }]}><Feather name="map-pin" size={28} color={colors.primary} /><Text style={{ color: colors.text }}>Map tiles unavailable</Text></View>}
          </View>
        ) : current ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`View ${current.kind}: ${current.name}`} onPress={open}
            style={({ pressed }) => [styles.stage, { opacity: pressed ? 0.85 : 1 }]}>
            {current.kind === "photo" && failedImage !== current.id ? (
              <Image key={current.id} source={{ uri: publicUrl(current.url, apiOrigin()) }} resizeMode="cover" accessible={false}
                style={StyleSheet.absoluteFill} onError={() => setFailedImage(current.id)} />
            ) : (
              <View style={[styles.fallback, { backgroundColor: colors.background }]}>
                <Feather name={current.kind === "video" ? "play-circle" : "image"} size={40} color={colors.primary} />
                <Text style={[styles.fallbackText, { color: colors.text }]} numberOfLines={2}>{current.kind === "video" ? "Play video" : "Image unavailable"}</Text>
              </View>
            )}
          </Pressable>
        ) : null}
        <View pointerEvents="box-none" style={styles.railPosition}>
          <View style={styles.rail} accessibilityLabel="Post media and map">
            {thumbnails.map((item, position) => (
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Show ${item.kind}: ${item.name}`}
                accessibilityHint={position === 1 && extra ? `${extra} more attachments are available using Next media` : undefined}
                onPress={() => setSelected(item.index)} style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.7 : 1 }]}>
                {item.kind === "photo" ? <Image source={{ uri: publicUrl(item.url, apiOrigin()) }} resizeMode="cover" accessible={false} style={StyleSheet.absoluteFill} />
                  : <Feather name="video" size={21} color={colors.onPrimary} accessible={false} />}
                {position === 1 && extra > 0 && <View pointerEvents="none" style={styles.more}><Text style={[styles.moreText, { color: colors.onPrimary }]}>+{extra}</Text></View>}
              </Pressable>
            ))}
            {hasMap && <Pressable accessibilityRole="button" accessibilityLabel={`Show location map for ${title}`} accessibilityState={{ selected: mapSelected }}
              onPress={showMap} style={({ pressed }) => [styles.tile, styles.mapTile, { backgroundColor: colors.surface, borderColor: mapSelected ? colors.primary : colors.border, opacity: pressed ? 0.7 : 1 }]}>
              <Feather name="map-pin" size={20} color={colors.primary} accessible={false} />
              <Text style={[styles.mapLabel, { color: colors.text }]}>Map</Text>
            </Pressable>}
          </View>
        </View>
        {total > 1 && <View style={styles.pager}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous media" onPress={() => setSelected((index - 1 + total) % total)} style={({ pressed }) => [styles.pageButton, { opacity: pressed ? 0.65 : 1 }]}>
            <Feather name="chevron-left" size={18} color={colors.onPrimary} accessible={false} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={mapSelected ? "Open hazard map from gallery" : "Open selected evidence"} onPress={open} style={({ pressed }) => [styles.pageButton, { opacity: pressed ? 0.65 : 1 }]}>
            <Text style={[styles.pageText, { color: colors.onPrimary }]}>{index + 1} / {total}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next media" onPress={() => setSelected((index + 1) % total)} style={({ pressed }) => [styles.pageButton, { opacity: pressed ? 0.65 : 1 }]}>
            <Feather name="chevron-right" size={18} color={colors.onPrimary} accessible={false} />
          </Pressable>
        </View>}
      </View>
      {preview !== null && <EvidencePreview initialIndex={preview} media={items.map((item) => ({ id: item.id, uri: publicUrl(item.url, apiOrigin()), kind: item.kind, name: item.name }))} onClose={() => setPreview(null)} />}
    </>
  );
}

const fill = { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 } as const;
const styles = StyleSheet.create({
  frame: { width: "100%", aspectRatio: 4 / 3, minHeight: 200, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  stage: { ...fill },
  fallback: { ...fill, justifyContent: "center", alignItems: "center", gap: 10, paddingHorizontal: 70 },
  fallbackText: { fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" },
  railPosition: { position: "absolute", top: 0, bottom: 0, right: 8, justifyContent: "center" },
  rail: { padding: 4, gap: 6, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.6)" },
  tile: { width: 48, height: 48, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", backgroundColor: "#18181B", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  mapTile: { gap: 1, height: "auto", minHeight: 48, paddingVertical: 4 },
  mapLabel: { fontSize: 11, lineHeight: 14, fontWeight: "700" },
  more: { ...fill, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
  moreText: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
  pager: { position: "absolute", left: 8, bottom: 8, flexDirection: "row", borderRadius: 24, backgroundColor: "rgba(0,0,0,0.65)" },
  pageButton: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  pageText: { fontSize: 12, lineHeight: 18, fontWeight: "600" },
});
