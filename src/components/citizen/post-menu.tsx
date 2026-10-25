import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { useSession } from "@/auth/session-provider";
import { Button, IconButton, Notice, Sheet, ui } from "@/components/ui/controls";
import { useTheme } from "@/constants/theme";
import { canDeletePost, confirmDeletion, deletionRequest, type DeleteTarget } from "@/lib/post-deletion";

/** This menu never authorizes a deletion: the shared server checks ownership again. */
type Props = {
  target: DeleteTarget;
  onDeleted: () => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
};
export function PostMenu(props: Props) {
  const { session } = useSession();
  if (!canDeletePost(props.target, session?.user.id)) return null;
  return <OwnedPostMenu key={`${session?.user.id}:${props.target.kind}:${props.target.id}`} {...props} />;
}

function OwnedPostMenu({ target, onDeleted, disabled = false, onBusyChange }: Props) {
  const { session, request } = useSession();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const updating = useRef(false), mounted = useRef(false);
  const token = useRef(session?.accessToken);
  useEffect(() => { token.current = session?.accessToken; }, [session?.accessToken]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const noun = target.kind === "post" ? "post" : "repost";
  const remove = async () => {
    if (updating.current || disabled || !canDeletePost(target, session?.user.id)) return;
    updating.current = true; setBusy(true); setError(""); onBusyChange?.(true);
    const credential = token.current;
    let confirmed = false;
    try {
      const path = deletionRequest(target, session?.user.id);
      confirmDeletion(await request(path, { method: "DELETE" }), target.kind);
      confirmed = true;
      if (mounted.current && credential === token.current) setOpen(false);
    } catch (cause) {
      if (mounted.current && credential === token.current)
        setError(cause instanceof Error ? cause.message : "Deletion could not be confirmed. Please check the post before trying again.");
    } finally {
      updating.current = false;
      if (mounted.current) { setBusy(false); onBusyChange?.(false); }
    }
    if (confirmed && mounted.current && credential === token.current) onDeleted();
  };
  return <>
    <IconButton label={`More options for your ${noun}`} icon="more-horizontal" disabled={disabled || busy}
      onPress={() => { setError(""); setConfirming(false); setOpen(true); }} />
    {open && <Sheet title={confirming ? `Delete this ${noun}?` : `${noun === "post" ? "Post" : "Repost"} options`}
      closeDisabled={busy} onClose={() => { if (!updating.current) setOpen(false); }}>
      {confirming ? <>
        <Text style={[ui.body, { color: colors.text }]}>This removes your {noun} from your feed and profile. The linked hazard, other people’s reports, and official government updates remain available.</Text>
        {!!error && <Notice error>{error}</Notice>}
        <Button label={busy ? "Deleting…" : `Confirm delete ${noun}`} variant="danger" busy={busy} disabled={disabled} icon="trash-2" onPress={() => void remove()} />
        <Button label="Cancel deletion" disabled={busy} onPress={() => { setConfirming(false); setError(""); }} />
      </> : <Button label={`Delete ${noun}`} icon="trash-2" variant="danger" onPress={() => setConfirming(true)} />}
    </Sheet>}
  </>;
}
