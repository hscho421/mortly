import { Platform } from "react-native";
import Constants from "expo-constants";
import { registerDevice, unregisterDevice } from "@/api/client";

/**
 * Push registration. expo-notifications remote push needs a development/production
 * build + an EAS projectId — it is NOT available in Expo Go. Everything here is
 * lazy-imported and fails soft (returns null / no-ops) so the app still runs in
 * Expo Go and on simulators.
 */

async function loadNotifications() {
  try {
    return await import("expo-notifications");
  } catch {
    return null;
  }
}

async function loadDevice() {
  try {
    return await import("expo-device");
  } catch {
    return null;
  }
}

let currentPushToken: string | null = null;

function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const eas = extra?.eas as { projectId?: string } | undefined;
  return eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
}

/**
 * Register this device for push and store the token server-side. Returns the
 * Expo push token, or null when unavailable (Expo Go / simulator / permission
 * denied / no EAS projectId).
 */
export async function registerForPush(sessionToken: string, locale: string): Promise<string | null> {
  const Notifications = await loadNotifications();
  const Device = await loadDevice();
  if (!Notifications || !Device || !Device.isDevice) return null;

  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) {
    const req = await Notifications.requestPermissionsAsync();
    if (!req.granted) return null;
  }

  const projectId = easProjectId();
  if (!projectId) {
    // eslint-disable-next-line no-console
    console.warn("[push] no EAS projectId — run `eas init` to enable push");
    return null;
  }

  try {
    const { data: expoToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerDevice(sessionToken, {
      token: expoToken,
      platform: Platform.OS === "ios" ? "IOS" : "ANDROID",
      locale,
      deviceName: Device.deviceName ?? undefined,
      appVersion: Constants.expoConfig?.version ?? undefined,
    });
    currentPushToken = expoToken;
    return expoToken;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[push] registration failed", e);
    return null;
  }
}

/** Unregister the current device token (best-effort; call before sign-out). */
export async function unregisterForPush(sessionToken: string): Promise<void> {
  if (!currentPushToken) return;
  try {
    await unregisterDevice(sessionToken, currentPushToken);
  } catch {
    // best-effort
  }
  currentPushToken = null;
}
