import { useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { apiOrigin } from "@/auth/api";
import { Avatar } from "@/components/ui/avatar";
import { Button, Chip, Notice, ui } from "@/components/ui/controls";
import {
  EvidencePreview,
  type PreviewMedia,
} from "@/components/citizen/evidence-preview";
import { AssessmentDetails } from "@/components/map/assessment-details";
import { useTheme } from "@/constants/theme";
import type { Author, DiscussionPost, Repost } from "@/lib/discussion";
import { postDestination } from "@/lib/discussion";
import { publicUrl } from "@/lib/feed";
import { profileImageUrl } from "@/lib/profile";
import { humanize, statusLabel } from "@/lib/report-contracts";

export function AuthorLine({
  author,
  createdAt,
  label,
}: {
  author: Author;
  createdAt: string;
  label?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.author}>
      <Avatar
        name={author.name}
        uri={profileImageUrl(author.avatarUrl, apiOrigin())}
        size={40}
      />
      <View style={styles.authorCopy}>
        <Text style={[ui.label, { color: colors.text }]}>{author.name}</Text>
        <Text style={[ui.caption, { color: colors.muted }]}>
          {label ? `${label} · ` : ""}
          {new Date(createdAt).toLocaleString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </Text>
      </View>
    </View>
  );
}
export function PostContent({
  post,
  quote,
}: {
  post: DiscussionPost;
  quote: Repost | null;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewMedia[] | null>(null);
  const [error, setError] = useState("");
  const [assessment, setAssessment] = useState(false);
  const official = quote?.governmentUpdate;
  const media = quote ? quote.media : post.media;
  const photos: PreviewMedia[] = [
    ...media.map((m) => ({
      id: m.id,
      uri: publicUrl(m.url, apiOrigin()),
      kind: m.kind,
      name: m.name,
    })),
    ...(official?.attachments
      .filter((a) => a.kind === "photo")
      .map((a) => ({
        id: a.id,
        uri: publicUrl(a.url, apiOrigin()),
        kind: "photo" as const,
        name: a.name,
      })) || []),
  ];
  const open = (id: string, repost?: string) =>
    router.push({
      pathname: "/post/[id]",
      params: { id, ...(repost ? { repost } : {}) },
    });
  const evidence = async (path: string) => {
    try {
      setError("");
      await Linking.openURL(publicUrl(path, apiOrigin()));
    } catch {
      setError("This evidence could not be opened. Please try again.");
    }
  };
  return (
    <View style={ui.gap}>
      <AuthorLine
        author={quote?.author || post.author}
        createdAt={quote?.createdAt || post.createdAt}
        label={official ? "Government update" : quote ? "Repost" : undefined}
      />
      <View style={ui.row}>
        <Chip tone={post.reportStatus === "RESOLVED" ? "success" : "orange"}>
          {statusLabel(post.reportStatus)}
        </Chip>
        <Chip>Current severity {post.reportSeverity}/10</Chip>
        {!!post.reportRiskLevel && (
          <Chip>{humanize(post.reportRiskLevel)}</Chip>
        )}
      </View>
      <Text
        accessibilityRole="header"
        style={[ui.title, { color: colors.text }]}
      >
        {quote
          ? official
            ? "Government update"
            : "Shared report"
          : post.title}
      </Text>
      {!!(quote?.body || (!quote && post.body)) && (
        <Text selectable style={[ui.body, { color: colors.text }]}>
          {quote ? quote.body : post.body}
        </Text>
      )}
      {post.deleted && (
        <Notice>
          The author deleted the original post. The hazard and official response
          history are retained.
        </Notice>
      )}
      {official && (
        <View
          style={[
            ui.card,
            { borderColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          <Text style={[ui.label, { color: colors.text }]}>
            Status when published:{" "}
            {official.status === "RESOLVED" ? "Resolved" : "In progress"}
          </Text>
          <Text style={[ui.caption, { color: colors.muted }]}>
            The badge above shows the current shared hazard status.
          </Text>
          <Text style={[ui.heading, { color: colors.text }]}>
            {official.budgetType === "ACTUAL" ? "Actual" : "Estimated"} budget
          </Text>
          {official.budget.map((b, i) => (
            <Text key={i} style={[ui.body, { color: colors.text }]}>
              {b.label} · {pesos(b.amount)}
            </Text>
          ))}
          <Text style={[ui.label, { color: colors.text }]}>
            Total:{" "}
            {pesos(
              official.budget.reduce(
                (sum, b) => sum + Math.round(b.amount * 100),
                0,
              ) / 100,
            )}
          </Text>
          {official.attachments
            .filter((a) => a.kind === "document")
            .map((a) => (
              <Button
                key={a.id}
                icon="file-text"
                label={`Open document: ${a.name}`}
                onPress={() => void evidence(a.url)}
              />
            ))}
        </View>
      )}
      {!!photos.length && (
        <>
          <ScrollView
            horizontal
            contentContainerStyle={styles.gallery}
            showsHorizontalScrollIndicator
          >
            {photos.map((m, i) => (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityLabel={`View ${m.kind === "video" ? "video" : "photo"}: ${m.name}`}
                onPress={() =>
                  setPreview([...photos.slice(i), ...photos.slice(0, i)])
                }
                style={({ pressed }) => [
                  styles.thumbnail,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                {m.kind === "photo" ? (
                  <Image
                    source={{ uri: m.uri }}
                    style={styles.image}
                    resizeMode="cover"
                    accessibilityLabel={m.name}
                  />
                ) : (
                  <View style={styles.video}>
                    <Text style={[ui.heading, { color: colors.primary }]}>
                      ▶ Play video
                    </Text>
                    <Text style={[ui.caption, { color: colors.muted }]}>
                      {m.name}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </ScrollView>
          <Text style={[ui.caption, { color: colors.muted }]}>
            Tap an attachment to view the full evidence.
          </Text>
        </>
      )}
      {quote?.quotedRepost && (
        <View
          style={[
            ui.card,
            { borderColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          <Text style={[ui.label, { color: colors.text }]}>
            {quote.quotedRepost.governmentUpdate
              ? "Quoted government update"
              : "Quoted repost"}{" "}
            · {quote.quotedRepost.author.name}
          </Text>
          <Text style={[ui.body, { color: colors.text }]}>
            {quote.quotedRepost.body}
          </Text>
          <Button
            label="Open quoted update"
            onPress={() => open(quote.post.id, quote.quotedRepost!.id)}
          />
        </View>
      )}
      {quote && (
        <View
          style={[
            ui.card,
            { borderColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          <Text style={[ui.caption, { color: colors.muted }]}>
            Original report · {post.author.name}
          </Text>
          <Text style={[ui.heading, { color: colors.text }]}>{post.title}</Text>
          <Button label="Open original report" onPress={() => open(post.id)} />
        </View>
      )}
      {!!post.locationName && (
        <Text style={[ui.body, { color: colors.muted }]}>
          {post.locationName}
        </Text>
      )}
      {post.governmentUpdateLink && (
        <Button
          label={
            post.reportStatus === "RESOLVED"
              ? "View official resolution"
              : "View latest official update"
          }
          icon="check-circle"
          onPress={() => {
            try {
              const target = postDestination(
                post.governmentUpdateLink!,
                apiOrigin(),
              );
              if (!target) throw new Error();
              router.push(target);
            } catch {
              setError(
                "The official update link is unavailable. Refresh this post.",
              );
            }
          }}
        />
      )}
      {!quote && (
        <>
          <Button
            label={
              assessment
                ? "Hide original assessment"
                : "View original assessment"
            }
            selected={assessment}
            icon="clipboard"
            onPress={() => setAssessment(!assessment)}
          />
          {assessment && (
            <View
              style={[
                ui.card,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            >
              <Text style={[ui.heading, { color: colors.text }]}>
                Original assessment
              </Text>
              <AssessmentDetails analysis={post.analysis} />
            </View>
          )}
        </>
      )}
      {!!error && <Notice error>{error}</Notice>}
      {preview && (
        <EvidencePreview media={preview} onClose={() => setPreview(null)} />
      )}
    </View>
  );
}
const pesos = (v: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    v,
  );
export const styles = StyleSheet.create({
  author: { flexDirection: "row", gap: 10, alignItems: "center" },
  authorCopy: { flex: 1, gap: 2 },
  gallery: { gap: 10 },
  thumbnail: {
    width: 240,
    height: 190,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  video: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
});
