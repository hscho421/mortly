import { useState, type ReactNode } from "react";
import { ScrollView, View, Text, Pressable, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { getRequestTitle } from "@mortly/core/requestConfig";
import { Screen, Header, Card, Button, Eyebrow } from "@/components/ui";
import { Loading, EmptyState, ErrorState } from "@/components/states";
import { useAdminQueue, useModerateQueue, useAdminStats } from "@/hooks/useAdmin";

type Action = { label: string; variant: "gold" | "light"; onPress: () => void };

export default function AdminHome() {
  const { t } = useTranslation();
  const router = useRouter();
  const q = useAdminQueue();
  const stats = useAdminStats();
  const mod = useModerateQueue();
  const [busyId, setBusyId] = useState<string | null>(null);

  const header = (
    <Header
      title={t("admin.nav.inbox", "관리")}
      right={
        <Pressable accessibilityRole="button" onPress={() => router.push("/account")} hitSlop={8}>
          <Text className="text-[13px] text-sage-500">{t("account.title", "계정")}</Text>
        </Pressable>
      }
    />
  );

  if (q.isPending) {
    return (
      <Screen>
        {header}
        <Loading />
      </Screen>
    );
  }
  if (q.isError || !q.data) {
    return (
      <Screen>
        {header}
        <ErrorState
          title={t("admin.people.loadFailed", "불러오지 못했습니다")}
          onRetry={() => q.refetch()}
          retryLabel={t("common.retry", "다시 시도")}
        />
      </Screen>
    );
  }

  const { pendingRequests, pendingBrokers, openReports, counts } = q.data;

  const confirm = (msg: string, onYes: () => void) =>
    Alert.alert(msg, "", [
      { text: t("request.cancel", "취소"), style: "cancel" },
      { text: t("common.confirm", "확인"), onPress: onYes },
    ]);

  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }}>
        {stats.data ? (
          <Text className="font-mono text-[11px] text-sage-500">
            {t("admin.totalUsers", "사용자")} {stats.data.users} · {t("admin.pendingVerifications", "인증대기")}{" "}
            {stats.data.pendingVerifications} · {t("admin.openReports", "신고")} {stats.data.openReports}
          </Text>
        ) : null}

        <View className="flex-row flex-wrap gap-2">
          <View className="w-[48%]">
            <Button title={t("admin.nav.requests", "요청")} variant="light" onPress={() => router.push("/(admin)/requests")} />
          </View>
          <View className="w-[48%]">
            <Button title={t("admin.nav.reports", "신고")} variant="light" onPress={() => router.push("/(admin)/reports")} />
          </View>
          <View className="w-[48%]">
            <Button title={t("admin.nav.people", "사용자")} variant="light" onPress={() => router.push("/(admin)/people")} />
          </View>
          <View className="w-[48%]">
            <Button title={t("admin.nav.messages", "대화")} variant="light" onPress={() => router.push("/(admin)/conversations")} />
          </View>
        </View>

        {counts.total === 0 ? (
          <View className="h-64">
            <EmptyState title={t("admin.queue.cleared", "모두 처리되었습니다")} />
          </View>
        ) : null}

        {pendingRequests.length ? (
          <Section title={`${t("admin.queue.pendingApprovals", "승인 대기 요청")} (${counts.pendingRequests})`}>
            {pendingRequests.map((r) => (
              <QueueCard
                key={r.id}
                busy={busyId === r.id}
                title={getRequestTitle(r, t)}
                subtitle={`${r.borrower.name ?? r.borrower.email} · ${[r.city, r.province].filter(Boolean).join(", ")}`}
                actions={[
                  {
                    label: t("admin.approve", "승인"),
                    variant: "gold",
                    onPress: () =>
                      confirm(t("admin.approveRequest", "이 요청을 승인하시겠습니까?"), () => {
                        setBusyId(r.id);
                        mod.request.mutate(
                          { id: r.publicId, status: "OPEN" },
                          { onSettled: () => setBusyId(null) },
                        );
                      }),
                  },
                  {
                    label: t("admin.reject", "반려"),
                    variant: "light",
                    onPress: () =>
                      confirm(t("admin.rejectRequest", "이 요청을 반려하시겠습니까?"), () => {
                        setBusyId(r.id);
                        mod.request.mutate(
                          { id: r.publicId, status: "REJECTED" },
                          { onSettled: () => setBusyId(null) },
                        );
                      }),
                  },
                ]}
              />
            ))}
          </Section>
        ) : null}

        {pendingBrokers.length ? (
          <Section title={`${t("admin.queue.pendingVerifications", "전문가 인증")} (${counts.pendingBrokers})`}>
            {pendingBrokers.map((b) => (
              <QueueCard
                key={b.id}
                busy={busyId === b.id}
                title={b.brokerageName}
                subtitle={`${b.user.name ?? b.user.email} · ${b.province}`}
                actions={[
                  {
                    label: t("admin.verify", "인증"),
                    variant: "gold",
                    onPress: () =>
                      confirm(t("admin.verifyBrokerConfirm", "이 전문가를 인증하시겠습니까?"), () => {
                        setBusyId(b.id);
                        mod.broker.mutate(
                          { id: b.id, verificationStatus: "VERIFIED" },
                          {
                            onSuccess: (res) => {
                              if (res?.status === "PENDING_SECOND_REVIEW") {
                                Alert.alert(
                                  t("admin.secondReviewTitle", "2차 승인 필요"),
                                  res.message ?? t("admin.secondReviewDesc", "다른 관리자의 승인이 필요합니다."),
                                );
                              }
                            },
                            onSettled: () => setBusyId(null),
                          },
                        );
                      }),
                  },
                  {
                    label: t("admin.reject", "거절"),
                    variant: "light",
                    onPress: () =>
                      confirm(t("admin.rejectBrokerConfirm", "이 전문가 인증을 거절하시겠습니까?"), () => {
                        setBusyId(b.id);
                        mod.broker.mutate(
                          { id: b.id, verificationStatus: "REJECTED" },
                          { onSettled: () => setBusyId(null) },
                        );
                      }),
                  },
                ]}
              />
            ))}
          </Section>
        ) : null}

        {openReports.length ? (
          <Section title={`${t("admin.queue.openReports", "신고")} (${counts.openReports})`}>
            {openReports.map((rep) => (
              <QueueCard
                key={rep.id}
                busy={busyId === rep.id}
                title={t(`admin.${rep.targetType.toLowerCase()}Target`, rep.targetType)}
                subtitle={rep.reason}
                actions={[
                  {
                    label: t("admin.resolve", "해결"),
                    variant: "gold",
                    onPress: () =>
                      confirm(t("admin.resolveReportConfirm", "이 신고를 해결 처리하시겠습니까?"), () => {
                        setBusyId(rep.id);
                        mod.report.mutate(
                          { id: rep.id, status: "RESOLVED" },
                          { onSettled: () => setBusyId(null) },
                        );
                      }),
                  },
                  {
                    label: t("admin.dismiss", "기각"),
                    variant: "light",
                    onPress: () =>
                      confirm(t("admin.dismissReportConfirm", "이 신고를 기각하시겠습니까?"), () => {
                        setBusyId(rep.id);
                        mod.report.mutate(
                          { id: rep.id, status: "DISMISSED" },
                          { onSettled: () => setBusyId(null) },
                        );
                      }),
                  },
                ]}
              />
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Eyebrow>{title}</Eyebrow>
      {children}
    </View>
  );
}

function QueueCard({
  title,
  subtitle,
  actions,
  busy,
}: {
  title: string;
  subtitle: string;
  actions: Action[];
  busy: boolean;
}) {
  return (
    <Card>
      <Text className="font-display text-[15px] font-semibold text-forest-800">{title}</Text>
      <Text className="mt-0.5 text-[13px] text-sage-500" numberOfLines={2}>
        {subtitle}
      </Text>
      <View className="mt-3 flex-row gap-2">
        {actions.map((a, i) => (
          <View key={a.label} className="flex-1">
            <Button
              title={a.label}
              variant={a.variant}
              size="sm"
              loading={busy && i === 0}
              disabled={busy}
              onPress={a.onPress}
            />
          </View>
        ))}
      </View>
    </Card>
  );
}
