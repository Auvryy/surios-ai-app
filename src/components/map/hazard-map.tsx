import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  Linking,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { apiOrigin } from "@/auth/api";
import { useSession } from "@/auth/session-provider";
import {
  Button,
  Chip,
  Field,
  IconButton,
  Notice,
  Sheet,
  ui,
} from "@/components/ui/controls";
import {
  EvidencePreview,
  type PreviewMedia,
} from "@/components/citizen/evidence-preview";
import { useTheme } from "@/constants/theme";
import { isRecord } from "@/auth/contracts";
import { ApiError } from "@/lib/api-client";
import { publicUrl } from "@/lib/feed";
import { postDestination } from "@/lib/discussion";
import {
  emptyMapFilters,
  filterHazards,
  parseMapHazard,
  parseMapRoute,
  parseMapSnapshot,
  type MapFilters,
  type MapHazard,
  type MapRoute,
  type MapSnapshot,
} from "@/lib/map-data";
import { humanize, statusLabel } from "@/lib/report-contracts";
import { SANTA_CRUZ, type Coordinate, type RoadWay } from "@/lib/roads";
import { currentLocation } from "@/reporting/location";
import referenceRoads from "@/assets/map/reference-roads.json";
import { AssessmentDetails } from "./assessment-details";
import { StreetMap } from "./street-map";
import type { MapEvent, MapFocus } from "./map-protocol";

export function HazardMap({
  onCreate,
  reportId,
}: {
  onCreate: (point?: Coordinate) => void;
  reportId?: string;
}) {
  const { colors } = useTheme(),
    { request } = useSession();
  const router = useRouter();
  const [data, setData] = useState<MapSnapshot | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [filters, setFilters] = useState<MapFilters>(emptyMapFilters);
  const [panel, setPanel] = useState<
    "filters" | "layers" | "legend" | "list" | null
  >(null);
  const [selectedId, setSelectedId] = useState(""),
    [clusterIds, setClusterIds] = useState<string[]>([]);
  const [reference, setReference] = useState(false),
    [tilesError, setTilesError] = useState(false);
  const [focus, setFocus] = useState<MapFocus | undefined>();
  const [preview, setPreview] = useState<PreviewMedia[] | null>(null);
  const [route, setRoute] = useState<MapRoute | null>(null),
    [routing, setRouting] = useState(false),
    [locating, setLocating] = useState(false),
    [linkError, setLinkError] = useState("");
  const [resolutionBusy, setResolutionBusy] = useState(false);
  const resolutionPending = useRef<AbortController | null>(null);
  const pending = useRef<AbortController | null>(null),
    routePending = useRef<AbortController | null>(null),
    focusId = useRef(0),
    firstLoad = useRef(true),
    alive = useRef(true),
    gpsVersion = useRef(0),
    selectedRef = useRef(""),
    handledReport = useRef("");
  const filtered = filterHazards(data?.hazards || [], filters),
    selected = data?.hazards.find((h) => h.id === selectedId);
  const listed = clusterIds.length
    ? filtered.filter((h) => clusterIds.includes(h.id))
    : filtered;
  const filterCount =
    Number(!!filters.search.trim()) +
    Number(!!filters.status) +
    Number(!!filters.type) +
    Number(filters.critical) +
    Number(filters.exposure);
  const fetchData = useCallback(() => {
    if (pending.current) return Promise.resolve();
    const controller = new AbortController();
    pending.current = controller;
    return request("/api/map/reports", { signal: controller.signal })
      .then(parseMapSnapshot)
      .then(async (snapshot) => {
        if (reportId && !snapshot.hazards.some((h) => h.id === reportId)) {
          const detail = await request(
            `/api/map/reports/${encodeURIComponent(reportId)}`,
            { signal: controller.signal },
          );
          if (!isRecord(detail)) throw new ApiError("Report not found.");
          snapshot = {
            ...snapshot,
            hazards: [...snapshot.hazards, parseMapHazard(detail.hazard)],
          };
        }
        if (controller.signal.aborted) return;
        setData(snapshot);
        setError("");
        if (reportId && reportId !== handledReport.current) {
          const hazard = snapshot.hazards.find((h) => h.id === reportId);
          if (hazard) {
            handledReport.current = reportId;
            selectedRef.current = hazard.id;
            setSelectedId(hazard.id);
            setFocus({
              key: ++focusId.current,
              point: [hazard.latitude, hazard.longitude],
              zoom: 17,
            });
          }
        }
        if (firstLoad.current && !reportId) {
          firstLoad.current = false;
          if (snapshot.hazards.length)
            setFocus({
              key: ++focusId.current,
              bounds: snapshot.hazards.map((h) => [h.latitude, h.longitude]),
            });
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Reports could not load. Try again.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          pending.current = null;
          setLoading(false);
        }
      });
  }, [request, reportId]);
  useEffect(() => {
    alive.current = true;
    const lifecycle = gpsVersion;
    void fetchData();
    const interval = setInterval(() => {
      if (AppState.currentState === "active") void fetchData();
    }, 30000);
    const subscription = AppState.addEventListener("change", (s) => {
      if (s === "active") void fetchData();
    });
    return () => {
      alive.current = false;
      lifecycle.current++;
      clearInterval(interval);
      subscription.remove();
      pending.current?.abort();
      pending.current = null;
      routePending.current?.abort();
      resolutionPending.current?.abort();
    };
  }, [fetchData]);
  const refresh = () => {
    if (!pending.current) {
      setLoading(true);
      void fetchData();
    }
  };
  const select = (hazard: MapHazard) => {
    resolutionPending.current?.abort();
    setResolutionBusy(false);
    routePending.current?.abort();
    setRouting(false);
    setRoute(null);
    setLinkError("");
    selectedRef.current = hazard.id;
    setSelectedId(hazard.id);
    setPanel(null);
    setFocus({
      key: ++focusId.current,
      point: [hazard.latitude, hazard.longitude],
      zoom: 17,
    });
  };
  const openPanel = (value: typeof panel) => {
    setPanel(value);
    setSelectedId("");
    selectedRef.current = "";
    setClusterIds([]);
  };
  const event = (event: MapEvent) => {
    if (event.type === "tiles-unavailable") setTilesError(true);
    if (event.type !== "select") return;
    const ids = event.ids.filter((id) => filtered.some((h) => h.id === id));
    if (ids.length === 1) {
      const h = filtered.find((h) => h.id === ids[0]);
      if (h) select(h);
    } else if (ids.length) {
      setClusterIds(ids);
      setSelectedId("");
      selectedRef.current = "";
      setPanel("list");
    }
  };
  const openLink = async (path: string) => {
    try {
      setLinkError("");
      const target = postDestination(path, apiOrigin());
      if (target) {
        setSelectedId(""); selectedRef.current = ""; setPanel(null);
        router.push(target);
        return;
      }
      await Linking.openURL(publicUrl(path, apiOrigin()));
    } catch {
      setLinkError("This link could not open. Please try again.");
    }
  };
  const openResolution = async (hazard: MapHazard) => {
    if (resolutionBusy || !hazard.posts.length) return;
    const controller = new AbortController();
    resolutionPending.current?.abort();
    resolutionPending.current = controller;
    setResolutionBusy(true);
    setLinkError("");
    try {
      const response = await request(
        `/api/community/posts/${encodeURIComponent(hazard.posts[0].id)}`,
        { signal: controller.signal },
      );
      if (controller.signal.aborted || selectedRef.current !== hazard.id)
        return;
      if (
        !isRecord(response) ||
        !isRecord(response.post) ||
        typeof response.post.governmentUpdateLink !== "string"
      )
        throw new ApiError(
          "No official explanation is linked yet. Open the source posts for their current history.",
        );
      await openLink(response.post.governmentUpdateLink);
    } catch (cause) {
      if (!controller.signal.aborted && alive.current)
        setLinkError(
          cause instanceof Error
            ? cause.message
            : "Could not open the official update.",
        );
    } finally {
      if (!controller.signal.aborted && alive.current) setResolutionBusy(false);
    }
  };
  const locate = async () => {
    if (locating) return;
    const version = ++gpsVersion.current;
    setLocating(true);
    try {
      const point = await currentLocation();
      if (alive.current && version === gpsVersion.current) {
        setFocus({ key: ++focusId.current, point, zoom: 16 });
        setError("");
      }
    } catch (cause) {
      if (alive.current && version === gpsVersion.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not find your location.",
        );
    } finally {
      if (alive.current && version === gpsVersion.current) setLocating(false);
    }
  };
  const directions = async (hazard: MapHazard) => {
    if (routing) return;
    const controller = new AbortController();
    routePending.current?.abort();
    routePending.current = controller;
    setRouting(true);
    setLinkError("");
    try {
      const result = parseMapRoute(
        await request(
          `/api/route?destLat=${hazard.latitude}&destLng=${hazard.longitude}&name=${encodeURIComponent(hazard.title)}`,
          { signal: controller.signal, timeoutMs: 45000 },
        ),
      );
      if (controller.signal.aborted || selectedRef.current !== hazard.id)
        return;
      setRoute(result);
      setFocus({ key: ++focusId.current, bounds: result.coordinates });
      setSelectedId("");
    } catch (cause) {
      if (!controller.signal.aborted)
        setLinkError(
          cause instanceof Error ? cause.message : "Directions unavailable.",
        );
    } finally {
      if (!controller.signal.aborted && alive.current) setRouting(false);
    }
  };
  return (
    <View style={styles.container}>
      <StreetMap
        state={{
          mode: "explore",
          pins: filtered.map(
            ({ id, title, latitude, longitude, severity, roadSegment }) => ({
              id,
              title,
              latitude,
              longitude,
              severity,
              roadSegment,
            }),
          ),
          referenceRoads: reference ? (referenceRoads as RoadWay[]) : [],
          focus,
          route: route?.coordinates,
          routeEstimated: route?.estimated,
        }}
        onEvent={event}
        label="Hazard map"
      />
      <View style={styles.top} pointerEvents="box-none">
        <View style={ui.row}>
          <View
            style={[
              styles.titleChip,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              accessibilityRole="header"
              style={[ui.label, { color: colors.text }]}
            >
              Hazard map
            </Text>
            <Text style={[ui.caption, { color: colors.muted }]}>
              {data?.hazards.length ?? "…"}
            </Text>
          </View>
          <Button
            label={`Reports · ${filtered.length}`}
            compact
            icon="list"
            onPress={() => openPanel("list")}
          />
          <IconButton
            label="Refresh map reports"
            icon="refresh-cw"
            disabled={loading}
            onPress={refresh}
          />
        </View>
        <View style={ui.row}>
          <Button
            label={`Filters${filterCount ? ` · ${filterCount}` : ""}`}
            compact
            icon="sliders"
            selected={!!filterCount}
            onPress={() => openPanel("filters")}
          />
          <Button
            label="Layers"
            compact
            icon="layers"
            onPress={() => openPanel("layers")}
          />
          <IconButton
            label="Fit visible hazards"
            icon="maximize"
            onPress={() =>
              setFocus({
                key: ++focusId.current,
                ...(filtered.length
                  ? {
                      bounds: filtered.map(
                        (h) => [h.latitude, h.longitude] as Coordinate,
                      ),
                    }
                  : { point: SANTA_CRUZ, zoom: 14 }),
              })
            }
          />
          <IconButton
            label="Find my location on map"
            icon="navigation"
            disabled={locating}
            onPress={() => void locate()}
          />
        </View>
      </View>
      <View style={styles.bottom} pointerEvents="box-none">
        <Button
          label="Legend"
          icon="info"
          compact
          onPress={() => openPanel("legend")}
        />
        <IconButton
          label="Create a post from the map"
          icon="camera"
          primary
          onPress={() => onCreate()}
        />
      </View>
      {loading && !data && (
        <View style={[styles.loading, { backgroundColor: colors.surface }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[ui.body, { color: colors.text }]}>
            Loading saved hazards…
          </Text>
        </View>
      )}
      {(!!error || tilesError) && (
        <View style={styles.error}>
          <Notice error={!!error}>
            {error ||
              "Street tiles unavailable. Reports and source links are still accessible from the list."}
          </Notice>
          {error && <Button label="Retry map reports" onPress={refresh} />}
        </View>
      )}
      {!loading && data?.hazards.length === 0 && !error && (
        <View
          style={[
            styles.empty,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[ui.heading, { color: colors.text }]}>
            No hazards reported yet
          </Text>
          <Text style={[ui.body, { color: colors.muted }]}>
            Published infrastructure posts appear here.
          </Text>
          <Button
            label="Create the first report"
            icon="camera"
            onPress={() => onCreate()}
          />
        </View>
      )}
      {route && (
        <View
          style={[
            styles.route,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[ui.label, { color: colors.text }]}>
            {route.estimated
              ? "Approximate direct connection"
              : `Directions from ${route.origin}`}
          </Text>
          <Text style={[ui.caption, { color: colors.muted }]}>
            {route.distance}
            {route.estimated
              ? " · Road routing unavailable"
              : ` · ${route.duration}`}
          </Text>
          <Button label="Clear directions" onPress={() => setRoute(null)} />
        </View>
      )}
      {panel === "filters" && (
        <Sheet
          title="Filter & sort"
          onClose={() => setPanel(null)}
          footer={
            <Button
              label={`Show ${filtered.length} matching reports`}
              variant="primary"
              onPress={() => setPanel("list")}
            />
          }
        >
          <Field
            label="Search map reports"
            value={filters.search}
            placeholder="Street, asset, hazard, or ticket…"
            onChangeText={(search) => setFilters({ ...filters, search })}
          />
          <FilterChoice
            title="Status"
            options={[
              ["", "All statuses"],
              ["REPORTED", "Reported"],
              ["IN_REPAIR", "In progress"],
              ["RESOLVED", "Resolved"],
            ]}
            value={filters.status}
            onChange={(status) => setFilters({ ...filters, status })}
          />
          <FilterChoice
            title="Issue type"
            options={[
              ["", "All types"],
              ...[...new Set(data?.hazards.map((h) => h.distressType) || [])]
                .sort()
                .map((type) => [type, humanize(type)] as [string, string]),
            ]}
            value={filters.type}
            onChange={(type) => setFilters({ ...filters, type })}
          />
          <FilterChoice
            title="Sort reports"
            options={[
              ["priority", "Priority first"],
              ["severity", "Highest severity"],
              ["newest", "Newest first"],
              ["support", "Most community support"],
            ]}
            value={filters.sort}
            onChange={(sort) =>
              setFilters({ ...filters, sort: sort as MapFilters["sort"] })
            }
          />
          <Toggle
            label="Critical severity (8–10)"
            value={filters.critical}
            onChange={(critical) => setFilters({ ...filters, critical })}
          />
          <Toggle
            label="High public exposure"
            value={filters.exposure}
            onChange={(exposure) => setFilters({ ...filters, exposure })}
          />
          <Button
            label="Reset map filters"
            onPress={() => setFilters(emptyMapFilters)}
          />
        </Sheet>
      )}
      {panel === "layers" && (
        <Sheet title="Map layers" onClose={() => setPanel(null)}>
          <Chip tone="orange">Street map</Chip>
          <Text style={[ui.body, { color: colors.muted }]}>OpenStreetMap</Text>
          <Toggle
            label="Reference roads"
            value={reference}
            onChange={setReference}
          />
          <Text style={[ui.body, { color: colors.muted }]}>
            Dashed lines show named road corridors for context. They do not
            indicate measured condition.
          </Text>
          <Text style={[ui.caption, { color: colors.muted }]}>
            Reference geometry matches the SuriOS website.
          </Text>
        </Sheet>
      )}
      {panel === "legend" && (
        <Sheet title="Reading the map" onClose={() => setPanel(null)}>
          <Text style={[ui.body, { color: colors.text }]}>
            Pin numbers show estimated severity.
          </Text>
          <View style={ui.row}>
            <Chip>1–3 · Low</Chip>
            <Chip tone="orange">4–7 · Moderate</Chip>
            <Chip tone="critical">8–10 · Critical</Chip>
          </View>
          <Text style={[ui.body, { color: colors.muted }]}>
            Solid colored lines mark reported road sections. End circles mark
            the extent; dashed reference roads provide context only.
          </Text>
          <Text style={[ui.body, { color: colors.muted }]}>
            A corner count means separate hazards overlap on screen. It does not
            mean they were merged.
          </Text>
          <Text style={[ui.body, { color: colors.muted }]}>
            The server links posts only when evidence and location identify the
            same issue. Community support affects priority, not damage severity.
            Open source posts to inspect the evidence and official resolutions.
          </Text>
        </Sheet>
      )}
      {panel === "list" && (
        <Sheet
          title={clusterIds.length ? "At this pin" : "Reports"}
          subtitle={`${listed.length} ${clusterIds.length ? "separate hazards" : "matching reports"}`}
          onClose={() => setPanel(null)}
          scroll={false}
        >
          <FlatList
            data={listed}
            keyExtractor={(h) => h.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => (
              <View style={[ui.card, { borderColor: colors.border }]}>
                <View style={ui.row}>
                  <Chip tone={item.severity >= 8 ? "critical" : "orange"}>
                    {item.severity}/10
                  </Chip>
                  <Chip
                    tone={item.status === "RESOLVED" ? "success" : "neutral"}
                  >
                    {statusLabel(item.status)}
                  </Chip>
                </View>
                <Text style={[ui.heading, { color: colors.text }]}>
                  {item.title}
                </Text>
                <Text style={[ui.caption, { color: colors.muted }]}>
                  {item.location} · {item.support} support · {item.observations}{" "}
                  observations
                </Text>
                <Button
                  label="Open report"
                  accessibilityLabel={`Open hazard: ${item.title}`}
                  onPress={() => select(item)}
                />
              </View>
            )}
            ListEmptyComponent={
              <View style={ui.gap}>
                <Text style={[ui.body, { color: colors.muted }]}>
                  No matching hazards.
                </Text>
                <Button
                  label="Clear filters"
                  onPress={() => {
                    setFilters(emptyMapFilters);
                    setClusterIds([]);
                  }}
                />
              </View>
            }
            ListFooterComponent={
              <Text
                style={[ui.caption, { color: colors.muted, paddingTop: 16 }]}
              >
                Refreshes every 30 seconds
                {data
                  ? ` · Updated ${new Date(data.asOf).toLocaleTimeString()}`
                  : ""}
              </Text>
            }
          />
        </Sheet>
      )}
      {selected && (
        <Sheet
          title={selected.title}
          subtitle={selected.location}
          onClose={() => {
            setSelectedId("");
            selectedRef.current = "";
          }}
          footer={
            <View style={ui.row}>
              <Button
                label="Directions"
                icon="navigation"
                busy={routing}
                onPress={() => void directions(selected)}
              />
              <Button
                label="Share an update"
                icon="camera"
                variant="primary"
                onPress={() => {
                  setSelectedId("");
                  onCreate([selected.latitude, selected.longitude]);
                }}
              />
            </View>
          }
        >
          <View style={ui.row}>
            <Chip tone={selected.status === "RESOLVED" ? "success" : "orange"}>
              {statusLabel(selected.status)}
            </Chip>
            <Chip>{humanize(selected.analysis.infrastructureType)}</Chip>
          </View>
          {selected.status === "RESOLVED" && selected.posts.length > 0 && (
            <Button
              label="View official resolution"
              icon="check-circle"
              busy={resolutionBusy}
              onPress={() => void openResolution(selected)}
            />
          )}
          <View
            style={[styles.metrics, { backgroundColor: colors.background }]}
          >
            {[
              ["Severity", `${selected.severity}/10`],
              ["Support", String(selected.support)],
              ["Priority", selected.priority.toFixed(2).replace(/0$/, "")],
            ].map(([label, value]) => (
              <View key={label} style={ui.group}>
                <Text style={[ui.caption, { color: colors.muted }]}>
                  {label}
                </Text>
                <Text style={[ui.heading, { color: colors.text }]}>
                  {value}
                </Text>
              </View>
            ))}
          </View>
          {selected.mediaKind === "photo" && !!selected.imageUrl && (
            <Image
              source={{ uri: publicUrl(selected.imageUrl, apiOrigin()) }}
              resizeMode="cover"
              accessibilityLabel="Hazard evidence photo"
              style={styles.photo}
            />
          )}
          {(selected.media.length > 0 || selected.imageUrl) && (
            <Button
              label="View hazard evidence"
              icon="image"
              onPress={() =>
                setPreview(
                  selected.media.length
                    ? selected.media.map((m) => ({
                        id: m.id,
                        uri: publicUrl(m.url, apiOrigin()),
                        kind: m.kind,
                        name: m.name,
                      }))
                    : [
                        {
                          id: selected.id,
                          uri: publicUrl(selected.imageUrl, apiOrigin()),
                          kind: selected.mediaKind,
                          name: "Field capture evidence",
                        },
                      ],
                )
              }
            />
          )}
          {selected.roadSegment && (
            <Button
              label={`View ${Math.round(selected.roadSegment.length)} m road section`}
              icon="git-commit"
              onPress={() => {
                setFocus({
                  key: ++focusId.current,
                  bounds: selected.roadSegment!.coordinates,
                });
                setSelectedId("");
              }}
            />
          )}
          <Text style={[ui.heading, { color: colors.text }]}>
            Source posts · {selected.posts.length}
          </Text>
          <Text style={[ui.caption, { color: colors.muted }]}>
            Severity comes from assessed evidence. Support and priority are
            separate. Resolved labels in source posts open the government
            explanation.
          </Text>
          {selected.posts.map((post) => (
            <View
              key={post.id}
              style={[ui.card, { borderColor: colors.border }]}
            >
              <Text style={[ui.label, { color: colors.text }]}>
                {post.title}
              </Text>
              <Text style={[ui.caption, { color: colors.muted }]}>
                {post.author} · {new Date(post.createdAt).toLocaleDateString()}
              </Text>
              {!!post.reason && (
                <Text style={[ui.caption, { color: colors.muted }]}>
                  {post.reason}
                </Text>
              )}
              <Button
                label="Open source post"
                accessibilityLabel={`Open source post: ${post.title}`}
                icon="arrow-up-right"
                onPress={() =>
                  void openLink(
                    `/community/post/${encodeURIComponent(post.id)}`,
                  )
                }
              />
            </View>
          ))}
          {!selected.posts.length && (
            <Text style={[ui.body, { color: colors.muted }]}>
              Submitted through field capture. No community post is linked to
              this hazard.
            </Text>
          )}
          <AssessmentDetails analysis={selected.analysis} />
          <Text style={[ui.caption, { color: colors.muted }]}>
            Updated {new Date(selected.updatedAt).toLocaleString()} ·{" "}
            {selected.observations} saved observations
          </Text>
          {!!linkError && <Notice error>{linkError}</Notice>}
        </Sheet>
      )}
      {preview && (
        <EvidencePreview media={preview} onClose={() => setPreview(null)} />
      )}
    </View>
  );
}
function FilterChoice({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: [string, string][];
  value: string;
  onChange: (value: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={ui.group}>
      <Text style={[ui.label, { color: colors.text }]}>{title}</Text>
      <View style={ui.row}>
        {options.map(([key, label]) => (
          <Button
            key={key}
            label={label}
            selected={value === key}
            compact
            onPress={() => onChange(key)}
          />
        ))}
      </View>
    </View>
  );
}
function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[ui.row, { minHeight: 48, justifyContent: "space-between" }]}>
      <Text style={[ui.body, { color: colors.text, flex: 1 }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, position: "relative", minHeight: 350 },
  top: { position: "absolute", top: 12, left: 12, right: 12, gap: 8 },
  titleChip: {
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bottom: {
    position: "absolute",
    left: 12,
    bottom: 28,
    flexDirection: "row",
    gap: 8,
  },
  loading: {
    position: "absolute",
    alignSelf: "center",
    top: "45%",
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  error: { position: "absolute", left: 12, right: 70, bottom: 90, gap: 6 },
  empty: {
    position: "absolute",
    left: 24,
    right: 24,
    top: "35%",
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  metrics: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 14,
    borderRadius: 14,
  },
  photo: { width: "100%", height: 200, borderRadius: 12 },
  route: {
    position: "absolute",
    left: 12,
    right: 72,
    bottom: 92,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
  },
});
