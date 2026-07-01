import { Alert, Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Header } from "@/components/ui";
import { ConversationThread } from "@/components/chat/ConversationThread";
import { useCloseConversation } from "@/hooks/useChat";

export default function BorrowerThread() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const close = useCloseConversation(id ?? "");

  function confirmClose() {
    Alert.alert(
      t("request.close", "대화 종료"),
      t("request.closeConfirm", "이 대화를 종료하시겠습니까?"),
      [
        { text: t("request.cancel", "취소"), style: "cancel" },
        { text: t("request.close", "종료"), style: "destructive", onPress: () => close.mutate() },
      ],
    );
  }

  return (
    <Screen>
      <Header
        title={t("borrower.nav.messages", "메시지")}
        onBack={() => router.back()}
        right={
          <Pressable accessibilityRole="button" onPress={confirmClose} hitSlop={8}>
            <Text className="text-[13px] text-sage-500">{t("request.close", "종료")}</Text>
          </Pressable>
        }
      />
      {id ? <ConversationThread id={id} /> : null}
    </Screen>
  );
}
