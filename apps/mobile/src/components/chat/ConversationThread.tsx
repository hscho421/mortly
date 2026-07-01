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
} from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Loading, ErrorState } from "@/components/states";
import { useConversation, useSendMessage } from "@/hooks/useChat";
import { useAuth } from "@/auth/AuthContext";
import { ApiError, type ChatMessage } from "@/api/client";

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
  const { user } = useAuth();
  const q = useConversation(id);
  const send = useSendMessage(id);
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

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
