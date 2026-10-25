import { useEffect, useRef, useMemo } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { Linking, StyleSheet, View } from "react-native";
import { mapDocument } from "./map-document";
import { parseMapEvent, type StreetMapProps } from "./map-protocol";
export function StreetMap({
  state,
  onEvent,
  label = "Street map",
}: StreetMapProps) {
  const ref = useRef<HTMLIFrameElement>(null),
    ready = useRef(false);
  const reducedMotion = useReducedMotion();
  const renderedState = useMemo(
    () => ({ ...state, reducedMotion: state.reducedMotion || reducedMotion }),
    [state, reducedMotion],
  );
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== ref.current?.contentWindow) return;
      const message = parseMapEvent(event.data);
      if (!message) return;
      if (message.type === "ready") {
        ready.current = true;
        ref.current?.contentWindow?.postMessage(
          { source: "surios-app", type: "state", state: renderedState },
          "*",
        );
      }
      if (message.type === "attribution")
        void Linking.openURL("https://www.openstreetmap.org/copyright");
      onEvent(message);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [renderedState, onEvent]);
  useEffect(() => {
    if (ready.current)
      ref.current?.contentWindow?.postMessage(
        { source: "surios-app", type: "state", state: renderedState },
        "*",
      );
  }, [renderedState]);
  return (
    <View style={styles.container}>
      <iframe
        ref={ref}
        title={label}
        srcDoc={mapDocument}
        sandbox="allow-scripts"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ border: 0, width: "100%", height: "100%", display: "block" }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F1ED" },
});
