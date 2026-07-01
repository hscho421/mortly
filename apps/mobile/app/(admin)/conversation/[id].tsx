import { View, Text, FlatList, Pressable, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Header, Badge } from "@/components/ui";
import { Loading, ErrorState } from "@/components/states";
import { useAdminConversation, useCloseAdminConversation } from "@/hooks/useAdmin";

export default function AdminConversationDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useAdminConversation(id ?? null);
  const close = useCloseAdminConversation();

  const closed = q.data?.status === "CLOSED";

  function confirmClose() {
    if (!id) return;
    Alert.alert(t("admin.closeConversation", "대화 종료"), t("request.closeConfirm", "이 대화를 종료하시겠습니까?"), [
      { text: t("request.cancel", "취소"), style: "cancel" },
      { text: t("common.confirm", "확인"), style: "destructive", onPress: () => close.mutate({ id }) },
    ]);
  }

  const header = (
    <Header
      title={q.data ? `${q.data.broker.brokerageName} · ${q.data.borrower.name ?? "—"}` : t("admin.nav.messages", "대화")}
      onBack={() => router.back()}
      right={
        q.data && !closed ? (
          <Pressable accessibilityRole="button" onPress={confirmClose} hitSlop={8}>
            <Text className="text-[13px] text-error-600">{t("admin.close", "종료")}</Text>
          </Pressable>
        ) : undefined
      }
    />
  );

  if (q.isPending) return <Screen>{header}<Loading /></Screen>;
  if (q.isError || !q.data) {
    return <Screen>{header}<ErrorState title={t("borrowerChat.failedToLoad", "대화를 불러오지 못했습니다")} onRetry={() => q.refetch()} retryLabel={t("common.retry", "다시 시도")} /></Screen>;
  }

  return (
    <Screen>
      {header}
      {closed ? (
        <View className="border-b border-cream-200 bg-cream-100 py-2">
          <Text className="text-center font-mono text-[11px] text-sage-400">{t("status.closed", "종료됨")}</Text>
        </View>
      ) : null}
      <FlatList
        data={q.data.messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) =>
          item.isSystem ? (
            <Text className="my-1 text-center text-[11px] text-sage-400">{item.body}</Text>
          ) : (
            <View className="gap-0.5">
              <View className="flex-row items-center gap-2">
                <Text className="font-display text-[12px] font-semibold text-forest-700">{item.sender.name ?? item.sender.email}</Text>
                <Badge label={item.sender.role} tone={item.sender.role === "BROKER" ? "info" : "neutral"} />
              </View>
              <Text className="text-[14px] leading-5 text-forest-800">{item.body}</Text>
            </View>
          )
        }
      />
    </Screen>
  );
}
