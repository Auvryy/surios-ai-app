import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useTheme } from "@/constants/theme";
import { Button, Sheet, ui } from "@/components/ui/controls";
export type PreviewMedia = {
  id: string;
  uri: string;
  kind: "photo" | "video";
  name: string;
};
export function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      player={player}
      style={styles.video}
      nativeControls
      contentFit="contain"
    />
  );
}
export function EvidencePreview({
  media,
  onClose,
  initialIndex = 0,
}: {
  media: PreviewMedia[];
  onClose: () => void;
  initialIndex?: number;
}) {
  const { colors } = useTheme(),
    [index, setIndex] = useState(() => Math.max(0, Math.min(initialIndex, media.length - 1))),
    [error, setError] = useState(false);
  const item = media[index];
  return (
    <Sheet
      title="Evidence"
      subtitle={`${index + 1} of ${media.length}`}
      onClose={onClose}
    >
      {item && (
        <>
          {item.kind === "photo" ? (
            <Image
              source={{ uri: item.uri }}
              style={styles.photo}
              resizeMode="contain"
              accessibilityLabel={item.name}
              onError={() => setError(true)}
            />
          ) : (
            <VideoPreview key={item.id} uri={item.uri} />
          )}
          <Text style={[ui.body, { color: colors.text }]}>{item.name}</Text>
          {error && (
            <Text
              accessibilityRole="alert"
              style={[ui.body, { color: colors.error }]}
            >
              This image could not load. Check your connection and reopen the
              evidence.
            </Text>
          )}
          <View style={ui.row}>
            <Button
              label="Previous evidence"
              icon="chevron-left"
              disabled={index === 0}
              onPress={() => {
                setError(false);
                setIndex(index - 1);
              }}
            />
            <Button
              label="Next evidence"
              icon="chevron-right"
              disabled={index === media.length - 1}
              onPress={() => {
                setError(false);
                setIndex(index + 1);
              }}
            />
          </View>
        </>
      )}
    </Sheet>
  );
}
const styles = StyleSheet.create({
  photo: { width: "100%", height: 320, borderRadius: 12 },
  video: {
    width: "100%",
    height: 260,
    borderRadius: 12,
    backgroundColor: "#18181B",
  },
});
