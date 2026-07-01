import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { Screen, Button, Eyebrow } from "@/components/ui";
import { useAuth } from "@/auth/AuthContext";

/**
 * Phase 0 placeholder home — proves the full stack is wired end-to-end
 * (login → Keychain session → role router → this screen). Real per-role
 * dashboards land in Phase 2/3.
 */
export function RoleHome({ label }: { label: string }) {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
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
          로그인 · 세션(Keychain) · API 클라이언트 · i18n · 디자인 토큰 · 역할 라우팅이 모두 연결되었습니다.
          화면 UI는 다음 단계에서 구현됩니다.
        </Text>
      </View>

      <View className="mt-4">
        <Button title={t("mobile.signOut", "로그아웃")} variant="light" onPress={signOut} />
      </View>
    </Screen>
  );
}
