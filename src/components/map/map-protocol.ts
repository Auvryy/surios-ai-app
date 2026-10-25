import { isRecord } from "@/auth/contracts";
import {
  validCoordinate,
  type Coordinate,
  type RoadSegment,
  type RoadWay,
} from "@/lib/roads";
export type MapPin = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  severity: number;
  roadSegment: RoadSegment | null;
};
export type MapFocus = {
  key: number;
  point?: Coordinate;
  bounds?: Coordinate[];
  zoom?: number;
};
export type MapState = {
  mode: "explore" | "point" | "road";
  pins?: MapPin[];
  point?: Coordinate | null;
  section?: RoadSegment | null;
  referenceRoads?: RoadWay[];
  route?: Coordinate[];
  routeEstimated?: boolean;
  focus?: MapFocus;
  disabled?: boolean;
  reducedMotion?: boolean;
};
export type MapEvent =
  | { type: "ready" | "tiles-unavailable" | "attribution" }
  | { type: "select"; ids: string[] }
  | { type: "pick" | "center"; point: Coordinate }
  | { type: "endpoint"; which: "start" | "end"; point: Coordinate };
export type StreetMapProps = {
  state: MapState;
  onEvent: (event: MapEvent) => void;
  label?: string;
};
export function parseMapEvent(input: unknown): MapEvent | null {
  let v = input;
  if (typeof input === "string") {
    try {
      v = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (!isRecord(v) || v.source !== "surios-map" || typeof v.type !== "string")
    return null;
  if (["ready", "tiles-unavailable", "attribution"].includes(v.type))
    return { type: v.type } as MapEvent;
  if (
    v.type === "select" &&
    Array.isArray(v.ids) &&
    v.ids.length <= 1000 &&
    v.ids.every(
      (id): id is string => typeof id === "string" && id.length <= 100,
    )
  )
    return { type: "select", ids: v.ids };
  if ((v.type === "pick" || v.type === "center") && validCoordinate(v.point))
    return { type: v.type, point: v.point };
  if (
    v.type === "endpoint" &&
    (v.which === "start" || v.which === "end") &&
    validCoordinate(v.point)
  )
    return { type: "endpoint", which: v.which, point: v.point };
  return null;
}
