import { useEffect, useRef, useState } from "react";
import { Image, Text } from "react-native";
import * as Crypto from "expo-crypto";
import { useSession } from "@/auth/session-provider";
import { Button, Field, Notice, Sheet, ui } from "@/components/ui/controls";
import { useTheme } from "@/constants/theme";
import { ApiError } from "@/lib/api-client";
import {
  confirmRepost,
  type DiscussionPost,
  type Repost,
} from "@/lib/discussion";
import type { ProfilePhoto } from "@/lib/profile";
import { releaseProfilePhoto } from "@/lib/profile-media";
import { chooseRepostPhoto, repostForm } from "@/lib/repost-media";

export function RepostComposer({
  post,
  quote,
  onClose,
  onSaved,
}: {
  post: DiscussionPost;
  quote: Repost | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { colors } = useTheme();
  const { request } = useSession();
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<ProfilePhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [requestId] = useState(() => Crypto.randomUUID());
  const mounted = useRef(false),
    pending = useRef(false),
    choosing = useRef(false),
    photoRef = useRef<ProfilePhoto | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      releaseProfilePhoto(photoRef.current);
    };
  }, []);
  const choose = async () => {
    if (pending.current || choosing.current || uncertain) return;
    choosing.current = true;
    setPicking(true);
    setError("");
    try {
      const next = await chooseRepostPhoto();
      if (!mounted.current) {
        releaseProfilePhoto(next);
        return;
      }
      if (next) {
        releaseProfilePhoto(photoRef.current);
        photoRef.current = next;
        setPhoto(next);
      }
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The image could not be selected.",
        );
    } finally {
      choosing.current = false;
      if (mounted.current) setPicking(false);
    }
  };
  const publish = async () => {
    if (pending.current || choosing.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const form = repostForm(
        requestId,
        post.id,
        quote?.id || null,
        body,
        photoRef.current,
      );
      const result = await request("/api/community/reposts", {
        method: "POST",
        form,
      });
      confirmRepost(result, requestId, post.id);
      if (mounted.current) onSaved(requestId);
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "The repost could not be saved.",
        );
        if (
          !(cause instanceof ApiError) ||
          cause.status === 0 ||
          cause.status >= 500
        )
          setUncertain(true);
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const locked = busy || picking;
  return (
    <Sheet
      title="Repost"
      subtitle={
        quote?.governmentUpdate
          ? "Share this official update with your community."
          : "Share this report with your community."
      }
      onClose={onClose}
      closeDisabled={locked}
    >
      <Text style={[ui.heading, { color: colors.text }]}>
        {quote ? quote.body || post.title : post.title}
      </Text>
      <Text style={[ui.caption, { color: colors.muted }]}>
        Add your own message or an image when sharing this report.
      </Text>
      <Field
        label="Add a message (optional)"
        placeholder="Say something about this…"
        value={body}
        onChangeText={setBody}
        maxLength={1000}
        multiline
        editable={!locked && !uncertain}
      />
      <Text style={[ui.caption, { color: colors.muted }]}>
        {body.length}/1,000
      </Text>
      {photo && (
        <>
          <Image
            source={{ uri: photo.uri }}
            accessibilityLabel="Repost image preview"
            style={{ width: "100%", height: 200, borderRadius: 12 }}
            resizeMode="contain"
          />
          <Button
            label="Remove repost image"
            icon="x"
            disabled={locked || uncertain}
            onPress={() => {
              releaseProfilePhoto(photoRef.current);
              photoRef.current = null;
              setPhoto(null);
            }}
          />
        </>
      )}
      <Button
        label={
          picking
            ? "Opening photo library…"
            : photo
              ? "Replace image"
              : "Add image (optional)"
        }
        icon="image"
        disabled={locked || uncertain}
        onPress={() => void choose()}
      />
      <Text style={[ui.caption, { color: colors.muted }]}>
        One JPEG, PNG, or WebP image, up to 5 MB.
      </Text>
      {uncertain && (
        <Notice>
          The response was interrupted. Retry this same draft to check or finish
          saving it without creating a duplicate.
        </Notice>
      )}
      {!!error && <Notice error>{error}</Notice>}
      <Button
        label={uncertain ? "Retry repost" : "Publish repost"}
        icon="repeat"
        variant="primary"
        busy={busy}
        disabled={picking}
        onPress={() => void publish()}
      />
    </Sheet>
  );
}
