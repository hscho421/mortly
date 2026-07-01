import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Screen, Header } from "@/components/ui";
import { ConversationList } from "@/components/chat/ConversationList";

export default function BrokerMessages() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen>
      <Header title={t("borrower.nav.messages", "메시지")} onBack={() => router.back()} />
      <ConversationList
        onOpen={(id) => router.push({ pathname: "/(broker)/messages/[id]", params: { id } })}
      />
    </Screen>
  );
}
