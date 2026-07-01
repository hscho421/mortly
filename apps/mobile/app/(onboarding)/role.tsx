import { useState, type ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { Screen, Button, Eyebrow } from "@/components/ui";
import { useAuth } from "@/auth/AuthContext";
import { selectRole } from "@/api/client";
import type { SessionUser } from "@/auth/session";

type Role = "BORROWER" | "BROKER";

/**
 * Onboarding — one-time role selection. Shown when the JWT carries
 * needsRoleSelection (an OAuth sign-in that hasn't picked a role). POST
 * /api/auth/select-role sets it once and returns a refreshed token.
 */
export default function RoleSelect() {
  const { t } = useTranslation();
  const { token, user, updateSession } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!role || !token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await selectRole(token, role);
      const updated: SessionUser = { ...(user as SessionUser), role, needsRoleSelection: false };
      await updateSession(res.sessionToken ?? token, updated);
      // RootNavigator advances to the role home once needsRoleSelection clears.
    } catch {
      setError(t("mobile.onboarding.roleError", "역할을 저장하지 못했습니다. 다시 시도해주세요."));
      setBusy(false);
    }
  }

  return (
    <Screen className="justify-center gap-4 px-7">
      <Eyebrow>{t("mobile.onboarding.step", "시작하기")}</Eyebrow>
      <Text className="font-display text-[26px] font-semibold text-forest-800">
        {t("mobile.onboarding.roleTitle", "어떻게 이용하시나요?")}
      </Text>

      <View className="mt-1 gap-3">
        <RoleOption
          selected={role === "BORROWER"}
          onPress={() => setRole("BORROWER")}
          title={t("mobile.onboarding.borrowerTitle", "대출을 찾고 있어요")}
          desc={t("mobile.onboarding.borrowerDesc", "모기지 전문가에게 견적을 받고 상담하세요.")}
        />
        <RoleOption
          selected={role === "BROKER"}
          onPress={() => setRole("BROKER")}
          title={t("mobile.onboarding.brokerTitle", "모기지 전문가입니다")}
          desc={t("mobile.onboarding.brokerDesc", "고객 요청을 받고 대화를 시작하세요.")}
        />
      </View>

      {error ? <Text className="text-[13px] text-error-600">{error}</Text> : null}

      <Button
        title={t("mobile.continue", "계속하기")}
        onPress={submit}
        loading={busy}
        disabled={!role}
      />
    </Screen>
  );
}

function RoleOption({
  selected,
  onPress,
  title,
  desc,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  desc: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`rounded-sm border p-4 ${selected ? "border-amber-500 bg-amber-50" : "border-cream-300 bg-cream-50"}`}
    >
      <Text className="font-display text-[16px] font-semibold text-forest-800">{title}</Text>
      <Text className="mt-1 text-[13px] leading-5 text-sage-500">{desc}</Text>
    </Pressable>
  );
}
