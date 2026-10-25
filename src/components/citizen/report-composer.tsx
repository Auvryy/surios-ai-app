import Feather from "@expo/vector-icons/Feather";
import { randomUUID } from "expo-crypto";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSession } from "@/auth/session-provider";
import { useTheme } from "@/constants/theme";
import {
  Button,
  Chip,
  Field,
  IconButton,
  Notice,
  Sheet,
  ui,
} from "@/components/ui/controls";
import { LocationPicker } from "@/components/map/location-picker";
import { AssessmentDetails } from "@/components/map/assessment-details";
import type { Coordinate } from "@/lib/roads";
import type { PublishedReport } from "@/lib/report-contracts";
import { ReportController } from "@/reporting/report-controller";
import { assessmentForm, chooseEvidence } from "@/reporting/media";
import {
  EvidencePreview,
  VideoPreview,
  type PreviewMedia,
} from "./evidence-preview";

type Props = {
  onClose: () => void;
  onPublished: (report: PublishedReport) => void;
  initialPoint?: Coordinate;
};
export function ReportComposer({ onClose, onPublished, initialPoint }: Props) {
  const { colors } = useTheme(),
    { request, session } = useSession();
  const [controller] = useState(() => {
    const result = new ReportController(request, randomUUID, assessmentForm);
    if (initialPoint)
      result.setLocation({
        mode: "point",
        point: initialPoint,
        road: null,
        name: "",
      });
    return result;
  });
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [picking, setPicking] = useState(false),
    [discard, setDiscard] = useState(false),
    [preview, setPreview] = useState<PreviewMedia[] | null>(null);
  const alive = useRef(true),
    selecting = useRef(false);
  useEffect(() => {
    alive.current = true;
    controller.activate();
    return () => {
      alive.current = false;
      controller.dispose();
    };
  }, [controller]);
  const publishing = state.busy === "publishing",
    locked = publishing || picking;
  const select = async (camera: boolean) => {
    if (locked || selecting.current) return;
    selecting.current = true;
    setPicking(true);
    controller.showError("");
    try {
      const files = await chooseEvidence(camera);
      if (alive.current) controller.add(files);
    } catch (error) {
      if (alive.current)
        controller.showError(
          error instanceof Error
            ? error.message
            : "Could not open the picker. Try again.",
        );
    } finally {
      selecting.current = false;
      if (alive.current) setPicking(false);
    }
  };
  const close = () => {
    if (locked) return;
    if (state.attachments.length || state.title || state.body) setDiscard(true);
    else onClose();
  };
  const publish = async () => {
    const result = await controller.publish();
    if (result && alive.current) onPublished(result);
  };
  const cover = state.attachments.find((f) => f.id === state.cover);
  const allPreview = state.attachments.map((f) => ({
    id: f.id,
    uri: f.uri,
    kind: f.mimeType.startsWith("video/")
      ? ("video" as const)
      : ("photo" as const),
    name: f.name,
  }));
  return (
    <>
      <Sheet
        title="Start a post"
        subtitle="Public infrastructure update"
        onClose={close}
        closeDisabled={locked}
        footer={
          <>
            {state.busy === "assessing" ? (
              <Button
                label="Cancel assessment"
                onPress={() => controller.cancelAssessment()}
                icon="x"
              />
            ) : (
              <Button
                label={publishing ? "Publishing…" : "Publish report"}
                variant="primary"
                icon="arrow-up-right"
                busy={publishing}
                disabled={
                  locked ||
                  !state.assessment ||
                  !state.location.point ||
                  (state.location.mode === "road" && !state.location.road) ||
                  state.location.name.trim().length < 3 ||
                  state.title.trim().length < 3
                }
                onPress={() => void publish()}
              />
            )}
            {state.errorScope === "publish" && !!state.error && (
              <Notice error>{state.error}</Notice>
            )}
            <Text style={[ui.caption, { color: colors.muted }]}>
              Evidence and location will be public after publishing.
            </Text>
          </>
        }
      >
        <View style={ui.row}>
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Feather name="user" size={19} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[ui.label, { color: colors.text }]}>
              {session?.user.name}
            </Text>
            <Text style={[ui.caption, { color: colors.muted }]}>
              Roads, bridges, drainage, utilities & telecom
            </Text>
          </View>
        </View>
        <Field
          label="Headline"
          placeholder="What needs attention?"
          maxLength={120}
          value={state.title}
          onChangeText={(v) => controller.edit("title", v)}
          editable={!locked}
        />
        <Field
          label="What happened?"
          placeholder="Describe what you can see and a nearby landmark…"
          maxLength={2000}
          multiline
          value={state.body}
          onChangeText={(v) => controller.edit("body", v)}
          editable={!locked}
        />
        <View style={ui.gap}>
          <View style={[ui.row, { justifyContent: "space-between" }]}>
            <Text style={[ui.heading, { color: colors.text }]}>
              Photos & videos
            </Text>
            <Chip>{state.attachments.length}/6</Chip>
          </View>
          {cover ? (
            <View style={styles.cover}>
              {cover.mimeType.startsWith("video/") ? (
                <VideoPreview key={cover.id} uri={cover.uri} />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Preview selected evidence"
                  onPress={() => setPreview(allPreview)}
                >
                  <Image
                    source={{ uri: cover.uri }}
                    resizeMode="cover"
                    accessibilityLabel="Selected post cover"
                    style={styles.coverImage}
                  />
                </Pressable>
              )}
              <View
                style={[styles.coverLabel, { backgroundColor: colors.surface }]}
              >
                <Text
                  style={[
                    ui.caption,
                    { color: colors.text, fontWeight: "600" },
                  ]}
                >
                  Post cover
                </Text>
              </View>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Upload report evidence"
              disabled={locked}
              onPress={() => void select(false)}
              style={({ pressed }) => [
                styles.upload,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather name="camera" size={30} color={colors.primary} />
              <Text style={[ui.label, { color: colors.text }]}>
                Add a photo or video
              </Text>
              <Text style={[ui.caption, { color: colors.muted }]}>
                Show the issue clearly.
              </Text>
            </Pressable>
          )}
          {!!state.attachments.length && (
            <>
              <Text style={[ui.caption, { color: colors.muted }]}>
                Tap a thumbnail to choose the cover.
              </Text>
              <View style={styles.thumbnails}>
                {state.attachments.map((file, index) => (
                  <View key={file.id} style={styles.thumbnailSlot}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Use attachment ${index + 1} as cover`}
                      accessibilityState={{
                        selected: state.cover === file.id,
                        disabled: locked || !!state.busy,
                      }}
                      disabled={locked || !!state.busy}
                      onPress={() => controller.setCover(file.id)}
                      style={[
                        styles.thumbnail,
                        {
                          borderColor:
                            state.cover === file.id
                              ? colors.primary
                              : colors.border,
                          backgroundColor: colors.background,
                        },
                      ]}
                    >
                      {file.mimeType.startsWith("video/") ? (
                        <Feather
                          name="video"
                          size={25}
                          color={colors.primary}
                        />
                      ) : (
                        <Image
                          source={{ uri: file.uri }}
                          resizeMode="cover"
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      {state.cover === file.id && (
                        <View
                          style={[
                            styles.selected,
                            { backgroundColor: colors.primary },
                          ]}
                        >
                          <Feather
                            name="check"
                            size={14}
                            color={colors.onPrimary}
                          />
                        </View>
                      )}
                    </Pressable>
                    <IconButton
                      label={`Remove attachment ${index + 1}`}
                      icon="x"
                      disabled={locked}
                      onPress={() => controller.remove(file.id)}
                    />
                  </View>
                ))}
              </View>
            </>
          )}
          <View style={ui.row}>
            <Button
              label="Add photos or videos"
              icon="image"
              disabled={locked || state.attachments.length >= 6}
              busy={picking}
              onPress={() => void select(false)}
            />
            <Button
              label="Open camera"
              icon="camera"
              disabled={locked || state.attachments.length >= 6}
              onPress={() => void select(true)}
            />
          </View>
          <Text style={[ui.caption, { color: colors.muted }]}>
            Up to 6 files · 5 MB/photo · 25 MB/video · 50 MB total
          </Text>
          {state.errorScope === "media" && !!state.error && (
            <Notice error>{state.error}</Notice>
          )}
        </View>
        <View style={[ui.card, { borderColor: colors.border }]}>
          <View style={ui.row}>
            <Feather name="zap" size={18} color={colors.primary} />
            <Text style={[ui.heading, { color: colors.text }]}>
              AI assessment
            </Text>
          </View>
          {state.assessment ? (
            <AssessmentDetails analysis={state.assessment.analysis} />
          ) : (
            <Text style={[ui.body, { color: colors.muted }]}>
              AI checks your evidence with the headline and caption as context.
              You can review its findings before publishing.
            </Text>
          )}
          {state.busy === "assessing" && (
            <View style={ui.row}>
              <ActivityIndicator color={colors.primary} />
              <Text
                accessibilityLiveRegion="polite"
                style={[ui.body, { color: colors.text }]}
              >
                Uploading and assessing evidence…
              </Text>
            </View>
          )}
          <Button
            label={state.assessment ? "Assess again" : "Assess evidence"}
            icon="zap"
            onPress={() => void controller.assess()}
            disabled={locked || !!state.busy || !state.attachments.length}
          />
          {!!state.note && (
            <Text style={[ui.caption, { color: colors.muted }]}>
              {state.note}
            </Text>
          )}
          {state.rejection && <AssessmentDetails analysis={state.rejection} />}
          {state.errorScope === "assessment" && !!state.error && (
            <Notice error>{state.error}</Notice>
          )}
        </View>
        <View style={ui.gap}>
          <Text style={[ui.heading, { color: colors.text }]}>
            Where is the issue?
          </Text>
          <Field
            label="Location or landmark"
            value={state.location.name}
            maxLength={200}
            placeholder="Street, barangay, or nearby landmark"
            onChangeText={(name) =>
              controller.setLocation({ ...state.location, name })
            }
            editable={!locked}
          />
          <LocationPicker
            value={state.location}
            onChange={(v) => controller.setLocation(v)}
            disabled={locked}
          />
        </View>
      </Sheet>
      {discard && (
        <Sheet title="Discard this post?" onClose={() => setDiscard(false)}>
          <Text style={[ui.body, { color: colors.text }]}>
            Your unpublished text, location and evidence will be removed from
            this composer.
          </Text>
          <Button
            label="Keep editing"
            variant="primary"
            onPress={() => setDiscard(false)}
          />
          <Button label="Discard post" variant="danger" onPress={onClose} />
        </Sheet>
      )}
      {preview && (
        <EvidencePreview media={preview} onClose={() => setPreview(null)} />
      )}
    </>
  );
}
const styles = StyleSheet.create({
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  upload: {
    minHeight: 150,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
  },
  cover: { borderRadius: 14, overflow: "hidden" },
  coverImage: { width: "100%", aspectRatio: 4 / 3 },
  coverLabel: {
    position: "absolute",
    left: 10,
    top: 10,
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  thumbnails: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thumbnailSlot: { width: "30%", alignItems: "center", gap: 4 },
  thumbnail: {
    width: "100%",
    aspectRatio: 1,
    borderWidth: 2,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  selected: {
    position: "absolute",
    bottom: 5,
    right: 5,
    borderRadius: 10,
    padding: 3,
  },
});
