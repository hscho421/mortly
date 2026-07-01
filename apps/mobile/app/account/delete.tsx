import { useState } from "react";
import { ScrollView, View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useRouter } from "expo-router";
import { Screen, Header, Input, Button, Card } from "@/components/ui";
import { useAuth } from "@/auth/AuthContext";
import { deleteAccount, ApiError } from "@/api/client";

function mapDeleteError(err: unknown, t: TFunction): string {
  if (err instanceof ApiError) {
    if (err.status === 400) return t("account.passwordRequired", "비밀번호를 입력해주세요.");
    if (err.status === 403) return err.code; // "Incorrect password" / admin message
  }
  return t("account.deleteFailed", "계정 삭제에 실패했습니다. 다시 시도해주세요.");
}

export default function DeleteAccount() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [ack, setAck] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = ack.trim().toUpperCase() === "DELETE";

  async function doDelete() {
    if (!token || !confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(token, password || undefined);
      await signOut(); // clears the session → router sends to login
    } catch (e) {
      setError(mapDeleteError(e, t));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header title={t("account.deleteAccount", "계정 삭제")} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Card className="border-error-400 bg-error-50">
          <Text className="font-display text-[15px] font-semibold text-error-700">
            {t("account.deleteWarnTitle", "이 작업은 되돌릴 수 없습니다")}
          </Text>
          <Text className="mt-1 text-[13px] leading-5 text-error-600">
            {t("account.deleteWarnBody", "계정과 모든 요청·대화가 영구적으로 삭제됩니다.")}
          </Text>
        </Card>

        <Input
          label={t("account.currentPassword", "현재 비밀번호 (해당 시)")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        <Input
          label={t("account.typeDelete", "확인을 위해 DELETE 를 입력하세요")}
          value={ack}
          onChangeText={setAck}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        {error ? <Text className="text-[13px] text-error-600">{error}</Text> : null}

        <Button
          title={t("account.deleteAccount", "계정 삭제")}
          variant="destructive"
          onPress={doDelete}
          loading={busy}
          disabled={!confirmed}
        />
      </ScrollView>
    </Screen>
  );
}
