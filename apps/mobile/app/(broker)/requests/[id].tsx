import { useEffect, useState } from "react";
import { ScrollView, View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getRequestTitle } from "@mortly/core/requestConfig";
import { Screen, Header, Badge, Card, Button } from "@/components/ui";
import { Loading, ErrorState } from "@/components/states";
import { RequestFields } from "@/components/RequestFields";
import { statusMeta } from "@/lib/requestStatus";
import { respondGate, type RespondGate } from "@/lib/brokerGate";
import { useRequest } from "@/hooks/useRequests";
import { useBrokerProfile, useRespond } from "@/hooks/useBroker";
import { markRequestSeen, ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";

function mapRespondError(code: string, err: unknown, t: TFunction): string {
  switch (code) {
    case "REQUEST_NOT_OPEN":
      return t("broker.requestNotOpen", "이 요청은 더 이상 응답할 수 없습니다.");
    case "PREMIUM_EXCLUSIVE":
      return t("broker.premiumExclusiveError", "현재 프리미엄 브로커에게만 공개된 요청입니다.");
    case "UPGRADE_REQUIRED":
      return t("broker.upgradeFreeDesc", "무료 플랜은 고객에게 메시지를 보낼 수 없습니다.");
    case "SUBSCRIPTION_PAST_DUE":
      return t("broker.pastDueDesc", "구독 결제가 연체되었습니다.");
    case "NO_CREDITS":
      return t("credits.noCreditsMessage", "응답 크레딧이 없습니다.");
    default:
      return err instanceof ApiError ? err.code : t("broker.failedToRespond", "응답에 실패했습니다.");
  }
}

export default function BrokerRequestDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const q = useRequest(id ?? null);
  const profileQ = useBrokerProfile();
  const respond = useRespond();
  const [respondError, setRespondError] = useState<string | null>(null);

  useEffect(() => {
    if (id && token) markRequestSeen(token, id).catch(() => {});
  }, [id, token]);

  const header = <Header title={t("titles.brokerRequestDetail", "요청 상세")} onBack={() => router.back()} />;

  if (q.isPending || profileQ.isPending) {
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
          title={t("request.failedToLoad", "요청을 불러오지 못했습니다")}
          onRetry={() => q.refetch()}
          retryLabel={t("common.retry", "다시 시도")}
        />
      </Screen>
    );
  }

  const r = q.data;
  const status = statusMeta(r.status, t);
  const existingConvo = r.conversations?.[0]; // API pre-filters to this broker's own
  const gate = profileQ.data ? respondGate(profileQ.data, !!existingConvo, t) : null;

  function doRespond() {
    setRespondError(null);
    respond.mutate(
      { requestId: r.publicId },
      {
        onSuccess: (convo) =>
          router.replace({ pathname: "/(broker)/messages/[id]", params: { id: convo.id } }),
        onError: (err) => {
          const code = err instanceof ApiError && typeof err.body?.code === "string" ? err.body.code : "";
          setRespondError(mapRespondError(code, err, t));
        },
      },
    );
  }

  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        <View className="flex-row items-center justify-between">
          <Text className="font-display text-[22px] font-semibold text-forest-800">
            {getRequestTitle(r, t)}
          </Text>
          <Badge label={status.label} tone={status.tone} />
        </View>

        <RequestFields request={r} />

        {gate ? (
          <RespondSection
            gate={gate}
            existingConvoId={existingConvo?.id}
            loading={respond.isPending}
            error={respondError}
            onRespond={doRespond}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function RespondSection({
  gate,
  existingConvoId,
  loading,
  error,
  onRespond,
}: {
  gate: RespondGate;
  existingConvoId?: string;
  loading: boolean;
  error: string | null;
  onRespond: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  if (gate.kind === "responded") {
    return (
      <Card className="border-success-500 bg-success-50">
        <Text className="font-display text-[14px] font-semibold text-success-700">
          {t("broker.alreadyMessaged", "이미 응답한 요청입니다")}
        </Text>
        <View className="mt-3">
          <Button
            title={t("broker.goToMessages", "메시지로 이동")}
            variant="light"
            onPress={() =>
              existingConvoId
                ? router.replace({ pathname: "/(broker)/messages/[id]", params: { id: existingConvoId } })
                : router.push("/(broker)/messages")
            }
          />
        </View>
      </Card>
    );
  }

  if (gate.kind === "blocked" || gate.kind === "no_credits") {
    return (
      <Card className="border-amber-400 bg-amber-50">
        <Text className="font-display text-[14px] font-semibold text-amber-800">{gate.title}</Text>
        <Text className="mt-1 text-[13px] leading-5 text-amber-700">{gate.desc}</Text>
        <Text className="mt-2 font-mono text-[11px] text-sage-500">
          {t("broker.manageOnWeb", "플랜/결제는 웹(mortly.ca)에서 관리하세요.")}
        </Text>
      </Card>
    );
  }

  // gate.kind === "ok"
  return (
    <View className="gap-2">
      {error ? <Text className="text-[13px] text-error-600">{error}</Text> : null}
      {!gate.unlimited && confirming ? (
        <Text className="text-[13px] text-sage-600">
          {t("broker.creditWillBeDeducted", "크레딧 1개가 사용됩니다.")} ·{" "}
          {t("broker.responseCredits", "크레딧")} {gate.creditsRemaining}
        </Text>
      ) : null}
      <Button
        title={
          gate.unlimited || confirming
            ? t("broker.respond", "상담 시작")
            : t("broker.respond", "상담 시작")
        }
        variant="gold"
        loading={loading}
        onPress={() => {
          if (gate.unlimited || confirming) onRespond();
          else setConfirming(true);
        }}
      />
    </View>
  );
}
