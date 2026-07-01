import { ScrollView, View, Text, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getRequestTitle } from "@mortly/core/requestConfig";
import { Screen, Header, Card, Button, Badge, Eyebrow } from "@/components/ui";
import { Loading, ErrorState } from "@/components/states";
import { RequestFields } from "@/components/RequestFields";
import { statusMeta } from "@/lib/requestStatus";
import { useAdminRequest, useModerateRequest } from "@/hooks/useAdmin";

export default function AdminRequestDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useAdminRequest(id ?? null);
  const mod = useModerateRequest();

  const header = <Header title={t("titles.brokerRequestDetail", "요청 상세")} onBack={() => router.back()} />;
  if (q.isPending) return <Screen>{header}<Loading /></Screen>;
  if (q.isError || !q.data) {
    return (
      <Screen>{header}<ErrorState title={t("request.failedToLoad", "요청을 불러오지 못했습니다")} onRetry={() => q.refetch()} retryLabel={t("common.retry", "다시 시도")} /></Screen>
    );
  }

  const r = q.data;
  const status = statusMeta(r.status, t);
  const convos = r.conversations ?? [];
  const busy = mod.setStatus.isPending || mod.remove.isPending;
  // Authoritative count from the server (not just the embedded list length).
  const convCount = r._count?.conversations ?? convos.length;
  const canDelete = (r.status === "OPEN" || r.status === "PENDING_APPROVAL") && convCount === 0;

  const confirm = (msg: string, onYes: () => void) =>
    Alert.alert(msg, "", [
      { text: t("request.cancel", "취소"), style: "cancel" },
      { text: t("common.confirm", "확인"), style: "destructive", onPress: onYes },
    ]);

  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View className="flex-row items-center justify-between">
          <Text className="font-display text-[20px] font-semibold text-forest-800">{getRequestTitle(r, t)}</Text>
          <Badge label={status.label} tone={status.tone} />
        </View>
        <Text className="font-mono text-[11px] text-sage-400">
          {r.borrower.name ?? r.borrower.email} · #{r.publicId}
        </Text>

        <RequestFields request={r} />

        {/* Moderation actions */}
        <View className="gap-2">
          {r.status === "PENDING_APPROVAL" ? (
            <View className="flex-row gap-2">
              <View className="flex-1"><Button title={t("admin.approve", "승인")} variant="gold" size="sm" loading={busy} onPress={() => confirm(t("admin.approveRequest", "이 요청을 승인하시겠습니까?"), () => mod.setStatus.mutate({ id: r.publicId, status: "OPEN" }))} /></View>
              <View className="flex-1"><Button title={t("admin.reject", "반려")} variant="light" size="sm" loading={busy} onPress={() => confirm(t("admin.rejectRequest", "이 요청을 반려하시겠습니까?"), () => mod.setStatus.mutate({ id: r.publicId, status: "REJECTED" }))} /></View>
            </View>
          ) : null}
          {r.status === "OPEN" || r.status === "IN_PROGRESS" ? (
            <Button title={t("admin.closeRequest", "요청 종료")} variant="light" size="sm" loading={busy} onPress={() => confirm(t("request.closeConfirm", "이 요청을 종료하시겠습니까?"), () => mod.setStatus.mutate({ id: r.publicId, status: "CLOSED" }))} />
          ) : null}
          {r.status === "REJECTED" ? (
            <Button title={t("admin.reopen", "재개")} variant="light" size="sm" loading={busy} onPress={() => confirm(t("admin.reopen", "이 요청을 다시 열겠습니까?"), () => mod.setStatus.mutate({ id: r.publicId, status: "OPEN" }))} />
          ) : null}
          {canDelete ? (
            <Button title={t("admin.deleteRequest", "요청 삭제")} variant="destructive" size="sm" loading={busy} onPress={() => confirm(t("request.deleteConfirm", "이 요청을 삭제하시겠습니까?"), () => mod.remove.mutate({ id: r.publicId }, { onSuccess: () => router.back() }))} />
          ) : null}
        </View>

        {/* Conversations on this request */}
        {convos.length ? (
          <View className="gap-2">
            <Eyebrow>{t("request.respondersTitle", "대화")} ({convos.length})</Eyebrow>
            {convos.map((c) => (
              <Card key={c.id} onPress={() => router.push({ pathname: "/(admin)/conversation/[id]", params: { id: c.id } })}>
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-[14px] text-forest-800" numberOfLines={1}>
                    {c.broker.brokerageName} · {c.broker.user.name}
                  </Text>
                  <Badge label={t(`status.${c.status.toLowerCase()}`, c.status)} tone="neutral" />
                </View>
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
