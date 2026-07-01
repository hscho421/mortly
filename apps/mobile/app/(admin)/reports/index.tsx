import { useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Screen, Header, Card, Badge } from "@/components/ui";
import { Loading, EmptyState, ErrorState } from "@/components/states";
import { ChipGroup } from "@/components/form";
import { useAdminReports, useAdminReportSummary } from "@/hooks/useAdmin";

const REPORT_TONE: Record<string, "error" | "gold" | "success" | "neutral"> = {
  OPEN: "error",
  REVIEWED: "gold",
  RESOLVED: "success",
  DISMISSED: "neutral",
};

export default function AdminReports() {
  const { t } = useTranslation();
  const router = useRouter();
  const [status, setStatus] = useState("OPEN");
  const [targetType, setTargetType] = useState("");

  const q = useAdminReports({ status: status || undefined, targetType: targetType || undefined });
  const summary = useAdminReportSummary();
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];

  const statusOpts = [
    { value: "OPEN", label: `${t("status.open", "미처리")}${summary.data ? ` ${summary.data.OPEN}` : ""}` },
    { value: "REVIEWED", label: t("status.reviewed", "검토됨") },
    { value: "RESOLVED", label: t("status.resolved", "해결됨") },
    { value: "DISMISSED", label: t("status.dismissed", "기각됨") },
    { value: "", label: t("admin.allStatuses", "전체") },
  ];
  const targetOpts = [
    { value: "", label: t("admin.allTypes", "전체") },
    { value: "BROKER", label: t("admin.brokerTarget", "전문가") },
    { value: "REQUEST", label: t("admin.requestTarget", "요청") },
    { value: "CONVERSATION", label: t("admin.conversationTarget", "대화") },
    { value: "USER", label: t("admin.userTarget", "사용자") },
  ];

  return (
    <Screen>
      <Header title={t("admin.nav.reports", "신고")} onBack={() => router.back()} />
      <View className="gap-3 border-b border-cream-200 p-4">
        <ChipGroup options={statusOpts} value={[status]} onChange={(v) => setStatus(v[0] ?? "")} />
        <ChipGroup options={targetOpts} value={[targetType]} onChange={(v) => setTargetType(v[0] ?? "")} />
      </View>

      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState title={t("admin.people.loadFailed", "불러오지 못했습니다")} onRetry={() => q.refetch()} retryLabel={t("common.retry", "다시 시도")} />
      ) : items.length === 0 ? (
        <EmptyState title={t("admin.queue.noOpenReports", "신고가 없습니다")} />
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
          renderItem={({ item }) => (
            <Card onPress={() => router.push({ pathname: "/(admin)/report/[id]", params: { id: item.id } })}>
              <View className="flex-row items-start justify-between gap-2">
                <Text className="flex-1 font-display text-[14px] font-semibold text-forest-800">
                  {t(`admin.${item.targetType.toLowerCase()}Target`, item.targetType)} · #{item.targetId}
                </Text>
                <Badge label={t(`status.${item.status.toLowerCase()}`, item.status)} tone={REPORT_TONE[item.status] ?? "neutral"} />
              </View>
              <Text className="mt-1 text-[13px] text-sage-600" numberOfLines={2}>{item.reason}</Text>
              <Text className="mt-1 font-mono text-[11px] text-sage-400">
                {item.reporter?.name ?? item.reporter?.email ?? "—"}
              </Text>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
