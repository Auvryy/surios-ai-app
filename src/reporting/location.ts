import * as Location from "expo-location";
import { ApiError } from "../lib/api-client";
import type { Coordinate } from "../lib/roads";
export async function currentLocation(): Promise<Coordinate> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted)
    throw new ApiError(
      "Location access is unavailable. Allow it in Settings, tap the map, or enter coordinates.",
    );
  // Foreground single fix only; never start background tracking.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new ApiError(
                "Location took too long. Tap the map or enter coordinates instead.",
              ),
            ),
          15000,
        );
      }),
    ]);
    return [result.coords.latitude, result.coords.longitude];
  } finally {
    clearTimeout(timer);
  }
}
