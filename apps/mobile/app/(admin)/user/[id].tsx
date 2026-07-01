import { useState, type ReactNode } from "react";
import { ScrollView, View, Text, Pressable, Alert, Modal, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Header, Card, Button, Badge, Avatar, Eyebrow } from "@/components/ui";
import { Loading, ErrorState } from "@/components/states";
import { avatarUrl } from "@/lib/avatar";
import { useAdminUser, useUserDetailActions } from "@/hooks/useAdmin";
import { useAuth } from "@/auth/AuthContext";

const USER_TONE: Record<string, "success" | "gold" | "error" | "neutral"> = {
  ACTIVE: "success",
  SUSPENDED: "gold",
  BANNED: "error",
  VERIFIED: "success",
  PENDING: "gold",
  REJECTED: "error",
};

export default function AdminUserDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me } = useAuth();
  const q = useAdminUser(id ?? null);
  const actions = useUserDetailActions(q.data?.id, q.data?.broker?.id ?? undefined);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const header = <Header title={t("admin.userDetail.title", "사용자 상세")} onBack={() => router.back()} />;

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
        <ErrorState title={t("admin.userDetail.notFound", "사용자를 찾을 수 없습니다")} onRetry={() => q.refetch()} retryLabel={t("common.retry", "다시 시도")} />
      </Screen>
    );
  }

  const u = q.data;
  const b = u.broker;
  const isSelf = u.id === me?.id;
  const isAdmin = u.role === "ADMIN";
  const active = u.status === "ACTIVE";

  const confirm = (msg: string, onYes: () => void, destructive = true) =>
    Alert.alert(msg, "", [
      { text: t("request.cancel", "취소"), style: "cancel" },
      { text: t("common.confirm", "확인"), style: destructive ? "destructive" : "default", onPress: onYes },
    ]);

  function submitNotice() {
    if (!subject.trim() || !body.trim()) return;
    actions.sendNotice.mutate(
      { subject: subject.trim(), body: body.trim() },
      {
        onSuccess: () => {
          setNoticeOpen(false);
          setSubject("");
          setBody("");
          Alert.alert(t("admin.noticeSent", "알림을 보냈습니다."));
        },
      },
    );
  }

  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Identity */}
        <Card>
          <View className="flex-row items-center gap-3">
            <Avatar name={u.name} uri={avatarUrl(b?.profilePhoto, b?.updatedAt)} size={52} />
            <View className="flex-1">
              <Text className="font-display text-[18px] font-semibold text-forest-800">{u.name ?? u.email}</Text>
              <Text className="text-[12px] text-sage-500">{u.email} · #{u.publicId}</Text>
            </View>
          </View>
          <View className="mt-3 flex-row flex-wrap gap-2">
            <Badge label={u.role} tone={u.role === "ADMIN" ? "neutral" : "info"} />
            <Badge label={t(`status.${u.status.toLowerCase()}`, u.status)} tone={USER_TONE[u.status] ?? "neutral"} />
            {u.emailVerified ? <Badge label={t("status.verified", "인증됨")} tone="success" /> : null}
          </View>
        </Card>

        {/* User actions */}
        {isAdmin || isSelf ? (
          <Text className="px-1 font-mono text-[11px] text-sage-400">
            {isSelf ? t("admin.self", "내 계정") : t("admin.adminAccount", "관리자 계정은 상태를 변경할 수 없습니다.")}
          </Text>
        ) : (
          <View className="flex-row gap-2">
            {active ? (
              <>
                <View className="flex-1">
                  <Button title={t("admin.suspend", "정지")} variant="light" size="sm" loading={actions.setStatus.isPending} onPress={() => confirm(t("admin.suspendUser", "이 사용자를 정지하시겠습니까?"), () => actions.setStatus.mutate({ status: "SUSPENDED" }))} />
                </View>
                <View className="flex-1">
                  <Button title={t("admin.ban", "차단")} variant="destructive" size="sm" loading={actions.setStatus.isPending} onPress={() => confirm(t("admin.banUser", "이 사용자를 차단하시겠습니까?"), () => actions.setStatus.mutate({ status: "BANNED" }))} />
                </View>
              </>
            ) : (
              <View className="flex-1">
                <Button title={t("admin.reactivate", "재활성화")} variant="gold" size="sm" loading={actions.setStatus.isPending} onPress={() => confirm(t("admin.reactivate", "이 사용자를 재활성화하시겠습니까?"), () => actions.setStatus.mutate({ status: "ACTIVE" }))} />
              </View>
            )}
          </View>
        )}

        <Button title={t("admin.sendNotice", "알림 보내기")} variant="light" size="sm" onPress={() => setNoticeOpen(true)} />

        {/* Broker */}
        {b ? (
          <Card>
            <View className="flex-row items-center justify-between">
              <Text className="font-display text-[15px] font-semibold text-forest-800">{b.brokerageName}</Text>
              <Badge label={t(`status.${b.verificationStatus.toLowerCase()}`, b.verificationStatus)} tone={USER_TONE[b.verificationStatus] ?? "neutral"} />
            </View>
            <View className="mt-2 flex-row flex-wrap gap-2">
              <Badge label={b.subscriptionTier} tone={b.subscriptionTier === "PREMIUM" ? "gold" : "neutral"} />
              <Text className="font-mono text-[11px] text-sage-500">
                {t("broker.responseCredits", "크레딧")} {b.responseCredits} · {b.province}
              </Text>
            </View>
            {b.phone ? <InfoRow label={t("broker.phone", "전화")} value={b.phone} /> : null}
            {b.licenseNumber ? <InfoRow label={t("broker.licenseNumber", "라이선스")} value={b.licenseNumber} /> : null}
            {b.bio ? <InfoRow label={t("broker.bio", "소개")} value={b.bio} /> : null}

            <View className="mt-3 flex-row gap-2">
              <View className="flex-1">
                <Button title={t("admin.verify", "인증")} variant="gold" size="sm" loading={actions.setVerification.isPending} onPress={() => confirm(t("admin.verifyBrokerConfirm", "이 전문가를 인증하시겠습니까?"), () => actions.setVerification.mutate({ verificationStatus: "VERIFIED" }, { onSuccess: (r) => { if ((r as { status?: string })?.status === "PENDING_SECOND_REVIEW") Alert.alert(t("admin.secondReviewTitle", "2차 승인 필요")); } }), false)} />
              </View>
              <View className="flex-1">
                <Button title={t("admin.reject", "거절")} variant="light" size="sm" loading={actions.setVerification.isPending} onPress={() => confirm(t("admin.rejectBrokerConfirm", "이 전문가 인증을 거절하시겠습니까?"), () => actions.setVerification.mutate({ verificationStatus: "REJECTED" }))} />
              </View>
            </View>
          </Card>
        ) : null}

        {/* Counts */}
        <View className="flex-row gap-2">
          <Stat label={t("admin.userDetail.borrowerRequests", "요청")} value={u._count.borrowerRequests} />
          <Stat label={t("admin.nav.messages", "대화")} value={u._count.conversations} />
          <Stat label={t("admin.queue.openReports", "신고")} value={u._count.reports} />
        </View>

        {/* Recent requests */}
        {u.borrowerRequests.length ? (
          <View className="gap-2">
            <Eyebrow>{t("admin.userDetail.borrowerRequests", "최근 요청")}</Eyebrow>
            {u.borrowerRequests.map((r) => (
              <Card key={r.id} onPress={() => router.push({ pathname: "/(admin)/request/[id]", params: { id: r.publicId } })}>
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-[14px] text-forest-800">
                    {[r.city, r.province].filter(Boolean).join(", ")} · #{r.publicId}
                  </Text>
                  <Badge label={t(`statusLabel.${r.status}`, r.status)} tone="neutral" />
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {/* Recent conversations */}
        {u.conversations.length ? (
          <View className="gap-2">
            <Eyebrow>{t("admin.nav.messages", "최근 대화")}</Eyebrow>
            {u.conversations.map((c) => (
              <Card key={c.id} onPress={() => router.push({ pathname: "/(admin)/conversation/[id]", params: { id: c.id } })}>
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-[14px] text-forest-800" numberOfLines={1}>
                    {c.broker?.user.name ?? c.borrower?.name ?? "—"} · {c._count.messages} msgs
                  </Text>
                  <Badge label={t(`status.${c.status.toLowerCase()}`, c.status)} tone="neutral" />
                </View>
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* Send-notice modal */}
      <Modal visible={noticeOpen} transparent animationType="slide" onRequestClose={() => setNoticeOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <Pressable className="absolute inset-0" onPress={() => setNoticeOpen(false)} />
          <View className="gap-3 rounded-t-sm bg-cream-50 p-5 pb-8">
            <Text className="font-display text-[16px] font-semibold text-forest-800">{t("admin.sendNotice", "알림 보내기")}</Text>
            <TextInput className="h-[44px] rounded-sm border border-cream-300 bg-cream-50 px-3 text-[15px] text-forest-900" placeholder={t("admin.noticeSubject", "제목")} placeholderTextColor="#9ea6bd" value={subject} onChangeText={setSubject} maxLength={200} />
            <TextInput className="h-[100px] rounded-sm border border-cream-300 bg-cream-50 px-3 py-2.5 text-[15px] text-forest-900" style={{ textAlignVertical: "top" }} placeholder={t("admin.noticeBody", "내용")} placeholderTextColor="#9ea6bd" value={body} onChangeText={setBody} multiline maxLength={2000} />
            <Button title={t("report.submit", "보내기")} variant="gold" onPress={submitNotice} loading={actions.sendNotice.isPending} disabled={!subject.trim() || !body.trim()} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mt-2 gap-0.5">
      <Text className="font-mono text-[10px] uppercase tracking-[0.1em] text-sage-400">{label}</Text>
      <Text className="text-[13px] leading-5 text-forest-800">{value}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }): ReactNode {
  return (
    <View className="flex-1 rounded-sm border border-cream-300 bg-cream-50 p-3">
      <Text className="font-display text-[20px] font-semibold text-forest-800">{value}</Text>
      <Text className="font-mono text-[10px] uppercase tracking-[0.1em] text-sage-400">{label}</Text>
    </View>
  );
}
