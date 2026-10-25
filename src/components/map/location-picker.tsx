import Feather from "@expo/vector-icons/Feather";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSession } from "@/auth/session-provider";
import { Button, Field, Notice, ui } from "@/components/ui/controls";
import { useTheme } from "@/constants/theme";
import { parseRoads } from "@/lib/report-contracts";
import {
  MIN_ROAD_METERS,
  SANTA_CRUZ,
  moveRoadEnd,
  nearestRoadPoint,
  pointAlong,
  roadLength,
  selectRoadSegment,
  validCoordinate,
  type Coordinate,
  type RoadWay,
} from "@/lib/roads";
import type { ReportLocation } from "@/reporting/contracts";
import { currentLocation } from "@/reporting/location";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { StreetMap } from "./street-map";
import type { MapEvent, MapFocus } from "./map-protocol";

export function LocationPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: ReportLocation;
  onChange: (value: ReportLocation) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme(),
    { request } = useSession();
  const [road, setRoad] = useState<RoadWay | null>(null);
  const [busy, setBusy] = useState<"road" | "gps" | null>(null);
  const [message, setMessage] = useState("");
  const [tilesError, setTilesError] = useState(false);
  const [pickEnd, setPickEnd] = useState<"start" | "end" | null>(null);
  const [center, setCenter] = useState<Coordinate>(value.point || SANTA_CRUZ);
  const [focus, setFocus] = useState<MapFocus | undefined>(
    value.point ? { key: 0, point: value.point, zoom: 17 } : undefined,
  );
  const [latitude, setLatitude] = useState(value.point?.[0].toFixed(6) || "");
  const [longitude, setLongitude] = useState(value.point?.[1].toFixed(6) || "");
  const reducedMotion = useReducedMotion();
  const pending = useRef<AbortController | null>(null),
    version = useRef(0),
    focusId = useRef(0),
    lastLookup = useRef(0),
    busyRef = useRef(false);
  useEffect(() => {
    const lifecycle = version;
    return () => {
      lifecycle.current++;
      pending.current?.abort();
    };
  }, []);
  const invalidate = () => {
    version.current++;
    pending.current?.abort();
    pending.current = null;
    busyRef.current = false;
    setBusy(null);
  };
  const locatePoint = (point: Coordinate, zoom = true) => {
    onChange({ ...value, point, road: null });
    setLatitude(point[0].toFixed(6));
    setLongitude(point[1].toFixed(6));
    if (zoom) setFocus({ key: ++focusId.current, point, zoom: 17 });
  };
  const saveRoad = (way: RoadWay, start: number, end: number) => {
    const section = selectRoadSegment(way, start, end),
      point = pointAlong(section.coordinates, section.length / 2);
    onChange({ ...value, point, road: section });
    setFocus({ key: ++focusId.current, bounds: section.coordinates });
  };
  const changeMode = (mode: ReportLocation["mode"]) => {
    if (disabled) return;
    invalidate();
    setRoad(null);
    setPickEnd(null);
    setMessage("");
    if (mode === "point" && value.point) {
      setLatitude(value.point[0].toFixed(6));
      setLongitude(value.point[1].toFixed(6));
    }
    onChange({
      ...value,
      mode,
      road: null,
      point: mode === "point" ? value.point : null,
    });
  };
  const moveEnd = (which: "start" | "end", point: Coordinate) => {
    if (!road || !value.road || disabled) return;
    const section = moveRoadEnd(
      road,
      value.road,
      which,
      nearestRoadPoint(road.coordinates, point).offset,
    );
    saveRoad(road, section.start, section.end);
    setPickEnd(null);
  };
  const selectAt = async (point: Coordinate) => {
    if (disabled || busyRef.current) return;
    if (value.mode === "point") {
      locatePoint(point, false);
      return;
    }
    if (pickEnd && road) {
      moveEnd(pickEnd, point);
      return;
    }
    if (Date.now() - lastLookup.current < 1100) {
      setMessage("Wait a moment before selecting another road.");
      return;
    }
    lastLookup.current = Date.now();
    busyRef.current = true;
    const controller = new AbortController(),
      current = ++version.current;
    pending.current = controller;
    setBusy("road");
    setMessage("");
    try {
      const ways = parseRoads(
        await request(`/api/roads?lat=${point[0]}&lng=${point[1]}`, {
          signal: controller.signal,
          timeoutMs: 45000,
        }),
      );
      if (current !== version.current) return;
      const nearest = ways
        .map((way) => ({ way, snap: nearestRoadPoint(way.coordinates, point) }))
        .sort((a, b) => a.snap.distance - b.snap.distance)[0];
      if (
        !nearest ||
        nearest.snap.distance > 40 ||
        roadLength(nearest.way.coordinates) < MIN_ROAD_METERS
      )
        throw new Error(
          "Choose closer to a mapped road, within 40 metres, or use a point pin.",
        );
      setRoad(nearest.way);
      const total = roadLength(nearest.way.coordinates),
        start = Math.max(
          0,
          Math.min(total - MIN_ROAD_METERS, nearest.snap.offset - 40),
        );
      saveRoad(nearest.way, start, Math.min(total, start + 80));
      setMessage(
        "Road selected. Drag A or B, or use the endpoint controls below.",
      );
    } catch (error) {
      if (current === version.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "Road lookup unavailable. Try again or use a point pin.",
        );
    } finally {
      if (current === version.current) {
        busyRef.current = false;
        setBusy(null);
        pending.current = null;
      }
    }
  };
  const locate = async () => {
    if (disabled || busyRef.current) return;
    const current = ++version.current;
    busyRef.current = true;
    setBusy("gps");
    setMessage("");
    try {
      const point = await currentLocation();
      if (current !== version.current) return;
      setCenter(point);
      setFocus({ key: ++focusId.current, point, zoom: 17 });
      if (value.mode === "point") locatePoint(point);
      else
        setMessage(
          "Location found. Tap the road or select it at the map center.",
        );
    } catch (error) {
      if (current === version.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "Use the map or enter coordinates instead.",
        );
    } finally {
      if (current === version.current) {
        busyRef.current = false;
        setBusy(null);
      }
    }
  };
  const event = (event: MapEvent) => {
    if (event.type === "center") setCenter(event.point);
    if (event.type === "pick") void selectAt(event.point);
    if (event.type === "endpoint") moveEnd(event.which, event.point);
    if (event.type === "tiles-unavailable") setTilesError(true);
  };
  const manual = () => {
    const point: Coordinate = [Number(latitude), Number(longitude)];
    if (!latitude.trim() || !longitude.trim() || !validCoordinate(point)) {
      setMessage(
        "Enter valid latitude (−85 to 85) and longitude (−180 to 180).",
      );
      return;
    }
    locatePoint(point);
    setMessage("Point pin placed at the entered coordinates.");
  };
  return (
    <View style={ui.gap}>
      <View style={ui.row}>
        <Button
          label="Point pin"
          selected={value.mode === "point"}
          disabled={disabled}
          onPress={() => changeMode("point")}
          icon="map-pin"
        />
        <Button
          label="Road section"
          selected={value.mode === "road"}
          disabled={disabled}
          onPress={() => changeMode("road")}
          icon="git-commit"
        />
      </View>
      <Text style={[ui.caption, { color: colors.muted }]}>
        {value.mode === "point"
          ? "Tap the map or drag the pin to the issue."
          : "Tap a road, or position the map and drop the pin. Mark 5–500 metres with A and B."}
      </Text>
      <View style={[styles.map, { borderColor: colors.border }]}>
        <StreetMap
          label="Report location map"
          state={{
            mode: value.mode,
            point: value.point,
            section: value.road,
            disabled: disabled || busy === "road",
            focus,
            reducedMotion,
          }}
          onEvent={event}
        />
      </View>
      <View style={ui.row}>
        <Button
          label={
            value.mode === "road"
              ? "Select road at map center"
              : "Drop pin at map center"
          }
          icon="map-pin"
          disabled={disabled || !!busy}
          busy={busy === "road"}
          onPress={() => void selectAt(center)}
        />
        <Button
          label="Use my location"
          icon="navigation"
          busy={busy === "gps"}
          disabled={disabled || !!busy}
          onPress={() => void locate()}
        />
      </View>
      {value.point && (
        <Text style={[ui.caption, { color: colors.muted }]}>
          Pin: {value.point[0].toFixed(6)}, {value.point[1].toFixed(6)}
        </Text>
      )}
      {value.mode === "road" && value.road && road && (
        <View style={[ui.card, { borderColor: colors.border }]}>
          <Text style={[ui.heading, { color: colors.text }]}>
            {value.road.name} · {Math.round(value.road.length)} m
          </Text>
          {(["start", "end"] as const).map((which) => (
            <View key={which} style={ui.group}>
              <Text style={[ui.label, { color: colors.text }]}>
                {which === "start" ? "A · Start" : "B · End"} ·{" "}
                {Math.round(value.road![which])} m along road
              </Text>
              <View style={ui.row}>
                <Button
                  label={`${which === "start" ? "A" : "B"} −5 m`}
                  disabled={
                    disabled ||
                    (which === "start"
                      ? value.road!.start <= Math.max(0, value.road!.end - 500)
                      : value.road!.length <= 5)
                  }
                  onPress={() => {
                    const s = moveRoadEnd(
                      road,
                      value.road!,
                      which,
                      value.road![which] - 5,
                    );
                    saveRoad(road, s.start, s.end);
                  }}
                />
                <Button
                  label={`${which === "start" ? "A" : "B"} +5 m`}
                  disabled={
                    disabled ||
                    (which === "start"
                      ? value.road!.length <= 5
                      : value.road!.end >=
                        Math.min(
                          roadLength(road.coordinates),
                          value.road!.start + 500,
                        ))
                  }
                  onPress={() => {
                    const s = moveRoadEnd(
                      road,
                      value.road!,
                      which,
                      value.road![which] + 5,
                    );
                    saveRoad(road, s.start, s.end);
                  }}
                />
                <Button
                  label={`Tap to move ${which === "start" ? "A" : "B"}`}
                  selected={pickEnd === which}
                  disabled={disabled}
                  onPress={() => {
                    setPickEnd(which);
                    setMessage(
                      `Tap the mapped road to move ${which === "start" ? "A" : "B"}.`,
                    );
                  }}
                />
              </View>
            </View>
          ))}
          <Text style={[ui.caption, { color: colors.muted }]}>
            The line marks the location extent. It does not prove the whole
            section is damaged.
          </Text>
        </View>
      )}
      {value.mode === "point" && (
        <View style={ui.gap}>
          <View style={styles.coordinates}>
            <View style={styles.coordinate}>
              <Field
                label="Latitude"
                value={latitude}
                onChangeText={setLatitude}
                keyboardType="numbers-and-punctuation"
                editable={!disabled}
                placeholder="14.281300"
              />
            </View>
            <View style={styles.coordinate}>
              <Field
                label="Longitude"
                value={longitude}
                onChangeText={setLongitude}
                keyboardType="numbers-and-punctuation"
                editable={!disabled}
                placeholder="121.417300"
              />
            </View>
          </View>
          <Button
            label="Place pin at coordinates"
            disabled={disabled}
            onPress={manual}
          />
        </View>
      )}
      {value.mode === "road" && !value.road && (
        <Text style={[ui.caption, { color: colors.primary }]}>
          Select a road before publishing, or switch to a point pin.
        </Text>
      )}
      {!!message && <Notice>{message}</Notice>}
      {tilesError && (
        <Notice>
          Street tiles could not load. Try your connection; you can still enter
          point coordinates.
        </Notice>
      )}
      <View style={ui.row}>
        <Feather name="map-pin" size={15} color={colors.primary} />
        <Text style={[ui.caption, { color: colors.muted }]}>
          Your map is saved with the report.
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  map: { height: 280, borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  coordinates: { flexDirection: "row", gap: 10 },
  coordinate: { flex: 1, minWidth: 0 },
});
