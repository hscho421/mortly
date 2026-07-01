import { View, Text, FlatList } from "react-native";
import { useTranslation } from "react-i18next";
import { Card, Avatar, Badge } from "@/components/ui";
import { Loading, EmptyState, ErrorState } from "@/components/states";
import { useConversations } from "@/hooks/useChat";
import { useAuth } from "@/auth/AuthContext";
import type { ConversationListItem } from "@/api/client";

/** Conversation list, shared by borrower + broker (viewer role picks the other party). */
export function ConversationList({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isBroker = user?.role === "BROKER";
  const q = useConversations();

  if (q.isPending) return <Loading />;
  if (q.isError) {
    return (
      <ErrorState
        title={t("borrowerChat.failedToLoad", "대화를 불러오지 못했습니다")}
        onRetry={() => q.refetch()}
        retryLabel={t("common.retry", "다시 시도")}
      />
    );
  }
  if (!q.data?.length) {
    return <EmptyState title={t("borrower.noActivity", "아직 대화가 없습니다")} />;
  }

  return (
    <FlatList
      data={q.data}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      renderItem={({ item }) => <Row item={item} isBroker={isBroker} onPress={() => onOpen(item.id)} />}
    />
  );
}

function Row({
  item,
  isBroker,
  onPress,
}: {
  item: ConversationListItem;
  isBroker: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const other = isBroker
    ? item.borrower.name || t("borrower.borrowerFallback", "고객")
    : item.broker.user.name || item.broker.brokerageName;
  const last = item.messages[0]?.body ?? "";
  const closed = item.status === "CLOSED";

  return (
    <Card onPress={onPress}>
      <View className="flex-row items-center gap-3">
        <Avatar name={other} uri={isBroker ? null : item.broker.profilePhoto} size={44} />
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 font-display text-[15px] font-semibold text-forest-800" numberOfLines={1}>
              {other}
            </Text>
            {closed ? (
              <Badge label={t("statusLabel.CLOSED", "종료됨")} tone="neutral" />
            ) : item.unreadCount > 0 ? (
              <View className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            ) : null}
          </View>
          <Text className="mt-0.5 text-[13px] text-sage-500" numberOfLines={1}>
            {last || t("borrower.noActivity", "메시지가 없습니다")}
          </Text>
        </View>
      </View>
    </Card>
  );
}
