import { useState } from "react";
import { ScrollView, View, Text, TextInput, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Header, Card, Button, Badge, Eyebrow } from "@/components/ui";
import { Loading, ErrorState } from "@/components/states";
import { useAdminReport, useModerateReport } from "@/hooks/useAdmin";
import type { AdminReport } from "@/api/client";

const REPORT_TONE: Record<string, "error" | "gold" | "success" | "neutral"> = {
  OPEN: "error",
  REVIEWED: "gold",
  RESOLVED: "success",
  DISMISSED: "neutral",
};

export default function AdminReportDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useAdminReport(id ?? null);

  const header = <Header title={t("admin.nav.reports", "신고 상세")} onBack={() => router.back()} />;
  if (q.isPending) return <Screen>{header}<Loading /></Screen>;
  if (q.isError || !q.data) {
    return <Screen>{header}<ErrorState title={t("admin.people.loadFailed", "불러오지 못했습니다")} onRetry={() => q.refetch()} retryLabel={t("common.retry", "다시 시도")} /></Screen>;
  }
  return (
    <Screen>
      {header}
      <ReportBody report={q.data} />
    </Screen>
  );
}

function ReportBody({ report }: { report: AdminReport }) {
  const { t } = useTranslation();
  const mod = useModerateReport();
  const [notes, setNotes] = useState(report.adminNotes ?? "");

  const doAct = (status?: string) =>
    mod.mutate({ id: report.id, status, adminNotes: notes.trim() || undefined });
  const confirmAct = (msg: string, status: string) =>
    Alert.alert(msg, "", [
      { text: t("request.cancel", "취소"), style: "cancel" },
      { text: t("common.confirm", "확인"), onPress: () => doAct(status) },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View className="flex-row items-center justify-between">
        <Text className="font-display text-[16px] font-semibold text-forest-800">
          {t(`admin.${report.targetType.toLowerCase()}Target`, report.targetType)} · #{report.targetId}
        </Text>
        <Badge label={t(`status.${report.status.toLowerCase()}`, report.status)} tone={REPORT_TONE[report.status] ?? "neutral"} />
      </View>

      <Card>
        <Eyebrow>{t("admin.reasonLabel", "사유")}</Eyebrow>
        <Text className="mt-1 text-[14px] leading-6 text-forest-800">{report.reason}</Text>
        <Text className="mt-3 font-mono text-[11px] text-sage-400">
          {t("admin.reporter", "신고자")}: {report.reporter?.name ?? report.reporter?.email ?? "—"}
        </Text>
      </Card>

      <View className="gap-2">
        <Eyebrow>{t("admin.notesLabel", "관리자 메모")}</Eyebrow>
        <TextInput
          className="h-[90px] rounded-sm border border-cream-300 bg-cream-50 px-3 py-2.5 text-[15px] text-forest-900"
          style={{ textAlignVertical: "top" }}
          placeholder={t("admin.addNotes", "메모 추가")}
          placeholderTextColor="#9ea6bd"
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={2000}
        />
        <Button title={t("admin.saveNotes", "메모만 저장")} variant="light" size="sm" loading={mod.isPending} disabled={!notes.trim()} onPress={() => doAct(undefined)} />
      </View>

      <View className="gap-2">
        {report.status !== "RESOLVED" ? (
          <Button title={t("admin.resolve", "해결됨으로 표시")} variant="gold" size="sm" loading={mod.isPending} onPress={() => confirmAct(t("admin.resolveReportConfirm", "이 신고를 해결 처리하시겠습니까?"), "RESOLVED")} />
        ) : null}
        {report.status === "OPEN" ? (
          <Button title={t("admin.markReviewed", "검토됨으로 표시")} variant="light" size="sm" loading={mod.isPending} onPress={() => confirmAct(t("admin.reviewReportConfirm", "이 신고를 검토됨으로 표시하시겠습니까?"), "REVIEWED")} />
        ) : null}
        {report.status !== "DISMISSED" ? (
          <Button title={t("admin.dismiss", "기각")} variant="light" size="sm" loading={mod.isPending} onPress={() => confirmAct(t("admin.dismissReportConfirm", "이 신고를 기각하시겠습니까?"), "DISMISSED")} />
        ) : null}
      </View>
    </ScrollView>
  );
}
