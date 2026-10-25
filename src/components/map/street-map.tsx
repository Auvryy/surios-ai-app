import { useEffect, useRef } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { mapDocument } from "./map-document";
import { parseMapEvent, type StreetMapProps } from "./map-protocol";
const source = { html: mapDocument, baseUrl: "https://surios.site" };
export function StreetMap({
  state,
  onEvent,
  label = "Street map",
}: StreetMapProps) {
  const ref = useRef<WebView<object>>(null);
  const ready = useRef(false);
  const send = () =>
    ref.current?.postMessage(
      JSON.stringify({ source: "surios-app", type: "state", state }),
    );
  useEffect(() => {
    if (ready.current)
      ref.current?.postMessage(
        JSON.stringify({ source: "surios-app", type: "state", state }),
      );
  }, [state]);
  return (
    <View style={styles.container} accessibilityLabel={label}>
      <WebView<object>
        ref={ref}
        source={source}
        style={styles.container}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled={false}
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
        mixedContentMode="never"
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        setSupportMultipleWindows={false}
        applicationNameForUserAgent="SuriOS-Mobile/1.0 (+https://surios.site)"
        onShouldStartLoadWithRequest={(event) =>
          event.url === "about:blank" || event.url === "https://surios.site/"
        }
        onMessage={(event) => {
          const message = parseMapEvent(event.nativeEvent.data);
          if (!message) return;
          if (message.type === "ready") {
            ready.current = true;
            send();
          }
          if (message.type === "attribution")
            void Linking.openURL("https://www.openstreetmap.org/copyright");
          onEvent(message);
        }}
        onError={() => onEvent({ type: "tiles-unavailable" })}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F1ED" },
});
