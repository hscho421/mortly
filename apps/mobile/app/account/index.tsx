import { useState } from "react";
import { ScrollView, View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Screen, Header, Input, Button, Eyebrow } from "@/components/ui";
import { useAuth } from "@/auth/AuthContext";
import { updateName } from "@/api/client";

export default function Account() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, token, signOut, updateSession } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || !token) return;
    setSaving(true);
    setNameMsg(null);
    try {
      const res = await updateName(token, trimmed);
      await updateSession(res.sessionToken ?? token, res.user);
      setNameMsg(t("account.saved", "저장되었습니다."));
    } catch {
      setNameMsg(t("account.saveFailed", "저장하지 못했습니다."));
    }
    setSaving(false);
  }

  const isAdmin = user?.role === "ADMIN";

  return (
    <Screen>
      <Header title={t("account.title", "계정")} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 26 }}>
        <View className="gap-3">
          <Eyebrow>{t("account.profile", "프로필")}</Eyebrow>
          <Input
            label={t("mobile.onboarding.nameLabel", "이름")}
            value={name}
            onChangeText={setName}
            maxLength={100}
          />
          <Text className="text-[12px] text-sage-400">{user?.email}</Text>
          {nameMsg ? <Text className="text-[12px] text-sage-500">{nameMsg}</Text> : null}
          <Button
            title={t("account.saveName", "이름 저장")}
            variant="light"
            onPress={saveName}
            loading={saving}
            disabled={!name.trim() || name.trim() === user?.name}
          />
        </View>

        <View className="gap-3">
          <Eyebrow>{t("account.session", "세션")}</Eyebrow>
          <Button title={t("mobile.signOut", "로그아웃")} variant="light" onPress={() => void signOut()} />
        </View>

        <View className="gap-3">
          <Eyebrow>{t("account.deleteAccount", "계정 삭제")}</Eyebrow>
          {isAdmin ? (
            <Text className="text-[13px] leading-5 text-sage-500">
              {t("account.adminNoDelete", "관리자 계정은 앱에서 삭제할 수 없습니다. 지원팀에 문의하세요.")}
            </Text>
          ) : (
            <Button
              title={t("account.deleteAccount", "계정 삭제")}
              variant="ghost"
              onPress={() => router.push("/account/delete")}
            />
          )}
        </View>

        {__DEV__ ? (
          <Button
            title="Kitchen sink (dev)"
            variant="ghost"
            size="sm"
            onPress={() => router.push("/kitchen-sink")}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
