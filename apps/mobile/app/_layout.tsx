import "../global.css";
import "@/i18n";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/auth/AuthContext";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

/** Redirects the user to the right stack based on session + role. */
function RootNavigator() {
  const { status, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    const group = segments[0];
    if (group === "kitchen-sink") return; // dev reference route — ungated
    if (status === "guest") {
      if (group !== "(auth)") router.replace("/(auth)/login");
      return;
    }
    // authed → route to the role home (onboarding gates are a follow-up)
    const target =
      user?.role === "BROKER" ? "(broker)" : user?.role === "ADMIN" ? "(admin)" : "(borrower)";
    if (group !== target) router.replace(`/${target}`);
  }, [status, user?.role, segments, router]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
