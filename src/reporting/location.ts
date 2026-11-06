import * as Location from "expo-location";
import { ApiError } from "../lib/api-client";
import type { Coordinate } from "../lib/roads";
export async function currentLocation(precise = false): Promise<Coordinate> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted)
    throw new ApiError(
      precise ? "Directions need your current location. Allow precise location in Settings and try again." : "Location access is unavailable. Allow it in Settings, tap the map, or enter coordinates.",
    );
  // Foreground single fix only; never start background tracking.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: precise ? Location.Accuracy.High : Location.Accuracy.Balanced,
      }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new ApiError(
                precise ? "Your current location took too long. Try directions again outdoors with location enabled." : "Location took too long. Tap the map or enter coordinates instead.",
              ),
            ),
          15000,
        );
      }),
    ]);
    if (precise && (result.coords.accuracy == null || result.coords.accuracy > 100))
      throw new ApiError("Your location is too approximate for directions. Enable precise location and try again outdoors.");
    return [result.coords.latitude, result.coords.longitude];
  } finally {
    clearTimeout(timer);
  }
}
