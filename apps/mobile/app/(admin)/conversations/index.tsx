import { useState } from "react";
import { View, Text, TextInput, FlatList, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Screen, Header, Card, Badge } from "@/components/ui";
import { Loading, EmptyState, ErrorState } from "@/components/states";
import { ChipGroup } from "@/components/form";
import { useAdminConversations } from "@/hooks/useAdmin";

export default function AdminConversations() {
  const { t } = useTranslation();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const q = useAdminConversations({ search: search || undefined, status: status || undefined });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];

  const statusOpts = [
    { value: "", label: t("admin.allStatuses", "전체") },
    { value: "ACTIVE", label: t("status.active", "활성") },
    { value: "CLOSED", label: t("status.closed", "종료됨") },
  ];

  return (
    <Screen>
      <Header title={t("admin.nav.messages", "대화")} onBack={() => router.back()} />
      <View className="gap-3 border-b border-cream-200 p-4">
        <TextInput
          className="h-[44px] rounded-sm border border-cream-300 bg-cream-50 px-3 text-[15px] text-forest-900"
          placeholder={t("admin.searchPlaceholder", "이름, 이메일 검색")}
          placeholderTextColor="#9ea6bd"
          value={input}
          onChangeText={setInput}
          returnKeyType="search"
          onSubmitEditing={() => setSearch(input.trim())}
        />
        <ChipGroup options={statusOpts} value={[status]} onChange={(v) => setStatus(v[0] ?? "")} />
      </View>

      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState title={t("admin.people.loadFailed", "불러오지 못했습니다")} onRetry={() => q.refetch()} retryLabel={t("common.retry", "다시 시도")} />
      ) : items.length === 0 ? (
        <EmptyState title={t("borrower.noActivity", "대화가 없습니다")} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          onEndReachedThreshold={0.5}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          ListFooterComponent={q.isFetchingNextPage ? <View className="py-4"><ActivityIndicator color="#c49a3a" /></View> : null}
          renderItem={({ item }) => (
            <Card onPress={() => router.push({ pathname: "/(admin)/conversation/[id]", params: { id: item.id } })}>
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 font-display text-[14px] font-semibold text-forest-800" numberOfLines={1}>
                  {item.broker.brokerageName} · {item.borrower.name ?? item.borrower.email}
                </Text>
                <Badge label={t(`status.${item.status.toLowerCase()}`, item.status)} tone="neutral" />
              </View>
              <Text className="mt-0.5 text-[12px] text-sage-500" numberOfLines={1}>
                {item.messages[0]?.body ?? "—"} · {item._count.messages} msgs
              </Text>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
