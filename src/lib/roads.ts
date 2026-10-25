// Location geometry mirrors the website; it never estimates condition or groups hazards.
export type Coordinate = [number, number];
export type RoadWay = { id: string; name: string; coordinates: Coordinate[] };
export type RoadSegment = RoadWay & {
  start: number;
  end: number;
  length: number;
};
export const SANTA_CRUZ: Coordinate = [14.2813, 121.4173];
export const MIN_ROAD_METERS = 5;
export const MAX_ROAD_METERS = 500;
export const validCoordinate = (value: unknown): value is Coordinate =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === "number" &&
  typeof value[1] === "number" &&
  Number.isFinite(value[0]) &&
  Number.isFinite(value[1]) &&
  Math.abs(value[0]) <= 85 &&
  Math.abs(value[1]) <= 180;
export function meters(a: Coordinate, b: Coordinate) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const h =
    Math.sin(rad(b[0] - a[0]) / 2) ** 2 +
    Math.cos(rad(a[0])) *
      Math.cos(rad(b[0])) *
      Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function roadLength(points: Coordinate[]) {
  return points
    .slice(1)
    .reduce((sum, point, i) => sum + meters(points[i], point), 0);
}
export function pointAlong(points: Coordinate[], offset: number): Coordinate {
  let remaining = Math.max(0, offset);
  for (let i = 1; i < points.length; i++) {
    const length = meters(points[i - 1], points[i]);
    if (remaining <= length && length) {
      const t = remaining / length;
      return [
        points[i - 1][0] + t * (points[i][0] - points[i - 1][0]),
        points[i - 1][1] + t * (points[i][1] - points[i - 1][1]),
      ];
    }
    remaining -= length;
  }
  return points[points.length - 1];
}
export function nearestRoadPoint(points: Coordinate[], target: Coordinate) {
  let best = { distance: Infinity, offset: 0, point: points[0] };
  let walked = 0;
  const scale = Math.cos((target[0] * Math.PI) / 180);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    const dx = (b[1] - a[1]) * scale,
      dy = b[0] - a[0];
    const t = Math.min(
      1,
      Math.max(
        0,
        ((target[1] - a[1]) * scale * dx + (target[0] - a[0]) * dy) /
          (dx * dx + dy * dy || 1),
      ),
    );
    const point: Coordinate = [
      a[0] + t * (b[0] - a[0]),
      a[1] + t * (b[1] - a[1]),
    ];
    const length = meters(a, b),
      distance = meters(point, target);
    if (distance < best.distance)
      best = { distance, offset: walked + t * length, point };
    walked += length;
  }
  return best;
}
export function selectRoadSegment(
  road: RoadWay,
  start: number,
  end: number,
): RoadSegment {
  const total = roadLength(road.coordinates);
  start = Math.max(0, Math.min(total, start));
  end = Math.max(start, Math.min(total, end));
  const coordinates: Coordinate[] = [pointAlong(road.coordinates, start)];
  let walked = 0;
  for (let i = 1; i < road.coordinates.length; i++) {
    walked += meters(road.coordinates[i - 1], road.coordinates[i]);
    if (walked > start && walked < end) coordinates.push(road.coordinates[i]);
  }
  coordinates.push(pointAlong(road.coordinates, end));
  return {
    id: road.id,
    name: road.name,
    coordinates,
    start,
    end,
    length: end - start,
  };
}
export function moveRoadEnd(
  road: RoadWay,
  section: RoadSegment,
  which: "start" | "end",
  offset: number,
) {
  return which === "start"
    ? selectRoadSegment(
        road,
        Math.min(
          section.end - MIN_ROAD_METERS,
          Math.max(0, section.end - MAX_ROAD_METERS, offset),
        ),
        section.end,
      )
    : selectRoadSegment(
        road,
        section.start,
        Math.max(
          section.start + MIN_ROAD_METERS,
          Math.min(
            roadLength(road.coordinates),
            section.start + MAX_ROAD_METERS,
            offset,
          ),
        ),
      );
}
