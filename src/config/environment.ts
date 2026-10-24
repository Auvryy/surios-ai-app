/** Public configuration only. EXPO_PUBLIC values are bundled into the app. */
export const environment = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '') || null,
};
// Deliberately no API calls yet: mobile authentication and contracts are pending.
