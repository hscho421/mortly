import { useState } from "react";
import { View, Text, TextInput, FlatList, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { getRequestTitle } from "@mortly/core/requestConfig";
import { Screen, Header, Card, Badge } from "@/components/ui";
import { Loading, EmptyState, ErrorState } from "@/components/states";
import { ChipGroup } from "@/components/form";
import { statusMeta } from "@/lib/requestStatus";
import { useAdminRequests } from "@/hooks/useAdmin";

const STATUSES = ["", "PENDING_APPROVAL", "OPEN", "IN_PROGRESS", "CLOSED", "EXPIRED", "REJECTED"];

export default function AdminRequests() {
  const { t } = useTranslation();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const q = useAdminRequests({ search: search || undefined, status: status || undefined });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];

  const statusOpts = STATUSES.map((s) => ({ value: s, label: s ? t(`statusLabel.${s}`, s) : t("admin.allStatuses", "전체") }));

  return (
    <Screen>
      <Header title={t("admin.nav.requests", "요청")} onBack={() => router.back()} />
      <View className="gap-3 border-b border-cream-200 p-4">
        <TextInput
          className="h-[44px] rounded-sm border border-cream-300 bg-cream-50 px-3 text-[15px] text-forest-900"
          placeholder={t("admin.searchPlaceholder", "지역, 도시, 이름, ID 검색")}
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
        <EmptyState title={t("broker.noMatchingRequests", "요청이 없습니다")} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          onEndReachedThreshold={0.5}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          ListFooterComponent={q.isFetchingNextPage ? <View className="py-4"><ActivityIndicator color="#c49a3a" /></View> : null}
          renderItem={({ item }) => {
            const s = statusMeta(item.status, t);
            return (
              <Card onPress={() => router.push({ pathname: "/(admin)/request/[id]", params: { id: item.publicId } })}>
                <View className="flex-row items-start justify-between gap-2">
                  <Text className="flex-1 font-display text-[15px] font-semibold text-forest-800">{getRequestTitle(item, t)}</Text>
                  <Badge label={s.label} tone={s.tone} />
                </View>
                <Text className="mt-0.5 text-[12px] text-sage-500" numberOfLines={1}>
                  {item.borrower.name ?? item.borrower.email} · {[item.city, item.province].filter(Boolean).join(", ")} · #{item.publicId}
                </Text>
              </Card>
            );
          }}
        />
      )}
    </Screen>
  );
}
