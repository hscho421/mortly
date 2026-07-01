import { useState } from "react";
import { Text, KeyboardAvoidingView, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { Screen, Input, Button, Eyebrow } from "@/components/ui";
import { useAuth } from "@/auth/AuthContext";
import { updateName } from "@/api/client";

/**
 * Onboarding — name entry. Shown when the JWT carries needsNameEntry (an OAuth
 * sign-in where the provider didn't return a name). PATCH /api/users/me clears
 * the flag and hands back a refreshed token; the router then advances.
 */
export default function NameEntry() {
  const { t } = useTranslation();
  const { token, user, updateSession } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || !token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await updateName(token, trimmed);
      await updateSession(res.sessionToken ?? token, res.user);
      // RootNavigator advances once needsNameEntry clears.
    } catch {
      setError(t("mobile.onboarding.nameError", "이름을 저장하지 못했습니다. 다시 시도해주세요."));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-center gap-4 px-7"
      >
        <Eyebrow>{t("mobile.onboarding.step", "시작하기")}</Eyebrow>
        <Text className="font-display text-[26px] font-semibold text-forest-800">
          {t("mobile.onboarding.nameTitle", "어떻게 불러드릴까요?")}
        </Text>
        <Text className="text-[14px] leading-5 text-sage-500">
          {t("mobile.onboarding.nameSubtitle", "프로필과 대화에 표시되는 이름입니다.")}
        </Text>
        <Input
          label={t("mobile.onboarding.nameLabel", "이름")}
          placeholder={t("mobile.onboarding.namePlaceholder", "이름을 입력하세요")}
          value={name}
          onChangeText={setName}
          autoFocus
          error={error}
          maxLength={100}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <Button
          title={t("mobile.continue", "계속하기")}
          onPress={submit}
          loading={busy}
          disabled={!name.trim()}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
