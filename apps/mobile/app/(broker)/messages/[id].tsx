import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Header } from "@/components/ui";
import { ConversationThread } from "@/components/chat/ConversationThread";

export default function BrokerThread() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  // Brokers can't close a thread (borrower-only) — no close action here.
  return (
    <Screen>
      <Header title={t("borrower.nav.messages", "메시지")} onBack={() => router.back()} />
      {id ? <ConversationThread id={id} /> : null}
    </Screen>
  );
}
