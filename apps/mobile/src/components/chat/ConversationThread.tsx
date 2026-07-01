import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loading, ErrorState } from "@/components/states";
import { Button } from "@/components/ui";
import { useConversation, useSendMessage } from "@/hooks/useChat";
import { useAuth } from "@/auth/AuthContext";
import { ApiError, reportTarget, blockUser, type ChatMessage } from "@/api/client";

function mapSendError(err: unknown, t: TFunction): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return t("borrowerChat.turnLimit", "상대방의 응답을 기다린 후 다시 보내주세요.");
    if (err.status === 429) return t("borrowerChat.rateLimited", "잠시 후 다시 시도해주세요.");
    if (err.status === 403) return err.code; // entitlement/block message from server
  }
  return t("borrowerChat.somethingWentWrong", "메시지를 보내지 못했습니다.");
}

export function ConversationThread({ id }: { id: string }) {
  const { t } = useTranslation();
  const { user, token } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useConversation(id);
  const send = useSendMessage(id);
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

  // The other participant (viewer-relative), used for report + block.
  const amBorrower = q.data?.borrower.id === user?.id;
  const other = q.data
    ? amBorrower
      ? { name: q.data.broker.user.name ?? q.data.broker.brokerageName, publicId: q.data.broker.user.publicId }
      : { name: q.data.borrower.name ?? t("borrower.borrowerFallback", "고객"), publicId: q.data.borrower.publicId }
    : null;

  function openSafetyMenu() {
    Alert.alert(other?.name ?? "", undefined, [
      { text: t("report.title", "신고하기"), onPress: () => setReportOpen(true) },
      { text: t("account.block", "차단하기"), style: "destructive", onPress: confirmBlock },
      { text: t("request.cancel", "취소"), style: "cancel" },
    ]);
  }

  function confirmBlock() {
    if (!token || !other?.publicId) return;
    Alert.alert(t("account.block", "차단하기"), t("account.blockConfirm", "이 사용자를 차단하시겠습니까? 대화가 숨겨집니다."), [
      { text: t("request.cancel", "취소"), style: "cancel" },
      {
        text: t("account.block", "차단"),
        style: "destructive",
        onPress: async () => {
          try {
            await blockUser(token, other.publicId as string);
            void qc.invalidateQueries({ queryKey: ["conversations"] });
            router.back();
          } catch {
            Alert.alert(t("common.error", "오류"), t("account.blockFailed", "차단하지 못했습니다."));
          }
        },
      },
    ]);
  }

  async function submitReport() {
    const reason = reportReason.trim();
    if (!token || !q.data || reason.length === 0) return;
    setReportBusy(true);
    try {
      await reportTarget(token, "CONVERSATION", q.data.publicId, reason);
      setReportOpen(false);
      setReportReason("");
      Alert.alert(t("report.success", "신고가 접수되었습니다."));
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 409
          ? t("report.duplicate", "이미 신고한 대화입니다.")
          : e instanceof ApiError && e.status === 429
            ? t("report.rateLimited", "오늘의 신고 한도에 도달했습니다.")
            : t("report.error", "신고에 실패했습니다.");
      Alert.alert(t("common.error", "오류"), msg);
    }
    setReportBusy(false);
  }

  // Server returns oldest→newest; invert the list so newest sits at the bottom
  // and the view sticks there as messages arrive.
  const inverted = useMemo(() => [...(q.data?.messages ?? [])].reverse(), [q.data?.messages]);

  function onSend() {
    const body = text.trim();
    if (!body || send.isPending) return;
    setSendError(null);
    send.mutate(body, {
      onSuccess: () => setText(""),
      onError: (err) => setSendError(mapSendError(err, t)),
    });
  }

  if (q.isPending) return <Loading />;
  if (q.isError || !q.data) {
    return (
      <ErrorState
        title={t("borrowerChat.failedToLoad", "대화를 불러오지 못했습니다")}
        onRetry={() => q.refetch()}
        retryLabel={t("common.retry", "다시 시도")}
      />
    );
  }

  const closed = q.data.status === "CLOSED";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 92 : 0}
      className="flex-1"
    >
      {other ? (
        <View className="flex-row items-center justify-between border-b border-cream-200 bg-cream-50 px-4 py-2">
          <Text className="flex-1 font-display text-[14px] font-semibold text-forest-800" numberOfLines={1}>
            {other.name}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("report.title", "신고")}
            onPress={openSafetyMenu}
            hitSlop={8}
          >
            <Text className="text-[20px] leading-[20px] text-sage-400">⋯</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={inverted}
        inverted
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item }) => <Bubble m={item} mine={item.senderId === user?.id} />}
      />

      {closed ? (
        <View className="border-t border-cream-200 bg-cream-100 p-4">
          <Text className="text-center text-[13px] text-sage-400">
            {t("borrowerChat.conversationClosed", "종료된 대화입니다.")}
          </Text>
        </View>
      ) : (
        <View className="border-t border-cream-200 bg-cream-100 p-3">
          {sendError ? <Text className="mb-1.5 text-[12px] text-error-600">{sendError}</Text> : null}
          <View className="flex-row items-end gap-2">
            <TextInput
              className="max-h-[120px] flex-1 rounded-sm border border-cream-300 bg-cream-50 px-3 py-2.5 text-[15px] text-forest-900"
              placeholder={t("borrowerChat.typeMessage", "메시지를 입력하세요")}
              placeholderTextColor="#9ea6bd"
              value={text}
              onChangeText={setText}
              multiline
              maxLength={5000}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("borrowerChat.send", "보내기")}
              onPress={onSend}
              disabled={!text.trim() || send.isPending}
              className={`h-[44px] w-[44px] items-center justify-center rounded-sm bg-amber-500 ${!text.trim() || send.isPending ? "opacity-50" : ""}`}
            >
              {send.isPending ? (
                <ActivityIndicator color="#0f1729" />
              ) : (
                <Text className="text-[20px] font-semibold text-forest-900">↑</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      <Modal visible={reportOpen} transparent animationType="slide" onRequestClose={() => setReportOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <Pressable
            className="absolute inset-0"
            onPress={() => setReportOpen(false)}
            accessibilityLabel={t("request.cancel", "닫기")}
          />
          <View className="gap-3 rounded-t-sm bg-cream-50 p-5 pb-8">
            <Text className="font-display text-[16px] font-semibold text-forest-800">
              {t("report.title", "신고하기")}
            </Text>
            <TextInput
              className="h-[100px] rounded-sm border border-cream-300 bg-cream-50 px-3 py-2.5 text-[15px] text-forest-900"
              style={{ textAlignVertical: "top" }}
              placeholder={t("report.placeholder", "신고 사유를 입력해주세요")}
              placeholderTextColor="#9ea6bd"
              value={reportReason}
              onChangeText={setReportReason}
              multiline
              maxLength={2000}
            />
            <Button
              title={t("report.submit", "신고 제출")}
              variant="destructive"
              onPress={submitReport}
              loading={reportBusy}
              disabled={!reportReason.trim()}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Bubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  if (m.isSystem) {
    return <Text className="my-1 text-center text-[11px] text-sage-400">{m.body}</Text>;
  }
  return (
    <View
      className={`max-w-[82%] rounded-sm px-3 py-2 ${mine ? "self-end bg-forest-800" : "self-start border border-cream-300 bg-cream-50"}`}
    >
      <Text className={`text-[14px] leading-5 ${mine ? "text-cream-50" : "text-forest-800"}`}>
        {m.body}
      </Text>
    </View>
  );
}
