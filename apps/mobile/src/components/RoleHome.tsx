import { View, Text, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Screen, Button, Eyebrow } from "@/components/ui";
import { useAuth } from "@/auth/AuthContext";
import { useMe } from "@/hooks/useMe";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Phase 0 placeholder home — proves the full stack is wired end-to-end
 * (login → Keychain session → role router → authed API → this screen). Real
 * per-role dashboards land in Phase 2/3.
 */
export function RoleHome({ label }: { label: string }) {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const me = useMe(); // fresh user from GET /api/users/me — proves the authed loop

  return (
    <Screen className="justify-center gap-3 px-6">
      <Eyebrow>{label}</Eyebrow>
      <Text className="font-display text-[28px] font-semibold text-forest-800">
        {user?.name ? `안녕하세요, ${user.name}님` : "안녕하세요"}
      </Text>
      <Text className="text-[14px] text-sage-500">
        {user?.email} · {user?.role}
      </Text>

      <View className="mt-2 rounded-sm border border-cream-300 bg-cream-50 p-4">
        <Text className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber-600">
          Phase 0 · foundation ✓
        </Text>
        <Text className="mt-2 text-[13px] leading-5 text-sage-500">
          로그인 · 세션(Keychain) · API · i18n · 디자인 토큰 · 역할 라우팅 · 실시간이 모두 연결되었습니다.
        </Text>

        {/* Live proof the authenticated API loop works from the device. */}
        <View className="mt-3 border-t border-cream-200 pt-3">
          {me.isPending ? (
            <ActivityIndicator color="#c49a3a" />
          ) : me.isError ? (
            <Text className="font-mono text-[11px] text-error-600">GET /me failed</Text>
          ) : (
            <Text className="font-mono text-[11px] text-sage-500">
              /api/users/me → {me.data?.role} · {me.data?.status} · realtime{" "}
              {isSupabaseConfigured ? "ready" : "off"}
            </Text>
          )}
        </View>
      </View>

      <View className="mt-4 gap-2">
        <Button title={t("mobile.signOut", "로그아웃")} variant="light" onPress={signOut} />
        {__DEV__ ? (
          <Button
            title="Kitchen sink (dev)"
            variant="ghost"
            size="sm"
            onPress={() => router.push("/kitchen-sink")}
          />
        ) : null}
      </View>
    </Screen>
  );
}
