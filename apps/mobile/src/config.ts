import Constants from "expo-constants";

/**
 * API base URL. Defaults to production; override per build with
 * EXPO_PUBLIC_API_URL (e.g. a staging URL or your machine's LAN IP for a
 * device hitting a local `next dev`).
 */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  "https://mortly.ca";

/**
 * The next-auth session-cookie name the API reads. Production is HTTPS, so
 * next-auth uses the __Secure- prefixed name. Sending our minted JWT under
 * this cookie lets every existing endpoint authenticate the app via
 * getServerSession with no server changes.
 */
export const SESSION_COOKIE_NAME = API_URL.startsWith("https")
  ? "__Secure-next-auth.session-token"
  : "next-auth.session-token";
