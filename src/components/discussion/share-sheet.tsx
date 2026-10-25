import { useRef, useState } from "react";
import { Platform, Text } from "react-native";
import { Button, Field, Notice, Sheet, ui } from "@/components/ui/controls";
import { useTheme } from "@/constants/theme";
import { sharePost, copyPostLink } from "@/lib/share-post";
export function ShareSheet({
  title,
  url,
  onClose,
}: {
  title: string;
  url: string;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const share = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await sharePost(title, url);
      if (result === "manual")
        setMessage("Select and copy the link below to share this post.");
    } catch {
      setMessage("Sharing could not open. Select and copy the link below.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <Sheet
      title="Share post"
      subtitle="Send this post to someone or copy its link."
      onClose={onClose}
      closeDisabled={busy}
    >
      <Button
        label="Share to apps"
        icon="share-2"
        busy={busy}
        onPress={() => void share()}
      />
      {Platform.OS === "web" && (
        <Button
          label="Copy link"
          icon="link"
          disabled={busy}
          onPress={() => {
            void copyPostLink(url).then((ok) =>
              setMessage(
                ok ? "Link copied." : "Select and copy the link below.",
              ),
            );
          }}
        />
      )}
      {Platform.OS === "web" ? (
        <Field
          label="Post link"
          value={url}
          editable={false}
          selectTextOnFocus
          multiline
        />
      ) : (
        <Text
          selectable
          accessibilityLabel="Post link"
          style={[ui.body, { color: colors.text }]}
        >
          {url}
        </Text>
      )}
      {!!message && <Notice>{message}</Notice>}
    </Sheet>
  );
}
