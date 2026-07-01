import { useEffect } from "react";
import { useRouter } from "expo-router";
import i18n from "@/i18n";
import { useAuth } from "@/auth/AuthContext";
import { registerForPush } from "@/notifications/push";

type PushData = { type?: string; conversationId?: string; requestId?: string };

/**
 * Registers the device for push when authenticated and deep-links on a
 * notification tap. Lazy + fail-soft — a no-op in Expo Go / simulators. The
 * push `data` payloads match the backend (lib/notify): message / request /
 * verification.
 */
export function usePushRegistration() {
  const { status, token, user } = useAuth();
  const router = useRouter();
  const role = user?.role;

  // Register the current device once authenticated.
  useEffect(() => {
    if (status !== "authed" || !token) return;
    void registerForPush(token, i18n.language);
  }, [status, token]);

  // Route to the right screen when a notification is tapped.
  useEffect(() => {
    let active = true;
    let subscription: { remove: () => void } | undefined;
    (async () => {
      let Notifications: typeof import("expo-notifications") | null = null;
      try {
        Notifications = await import("expo-notifications");
      } catch {
        return;
      }
      if (!active || !Notifications) return;
      subscription = Notifications.addNotificationResponseReceivedListener((resp) => {
        const data = (resp.notification.request.content.data ?? {}) as PushData;
        if (data.type === "message" && data.conversationId) {
          if (role === "BROKER") {
            router.push({ pathname: "/(broker)/messages/[id]", params: { id: data.conversationId } });
          } else {
            router.push({ pathname: "/(borrower)/messages/[id]", params: { id: data.conversationId } });
          }
        } else if (data.type === "request" && data.requestId) {
          router.push({ pathname: "/(borrower)/request/[id]", params: { id: data.requestId } });
        } else if (data.type === "verification") {
          router.push("/(broker)");
        }
      });
    })();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [role, router]);
}
