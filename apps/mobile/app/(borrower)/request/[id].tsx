import { ScrollView, View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getRequestTitle } from "@mortly/core/requestConfig";
import { Screen, Header, Badge, Card, Avatar, Eyebrow } from "@/components/ui";
import { Loading, ErrorState } from "@/components/states";
import { RequestFields } from "@/components/RequestFields";
import { statusMeta } from "@/lib/requestStatus";
import { useRequest } from "@/hooks/useRequests";
import type { ConversationSummary } from "@/api/client";

export default function RequestDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useRequest(id ?? null);

  return (
    <Screen>
      <Header title={t("titles.borrowerRequestDetail", "요청 상세")} onBack={() => router.back()} />
      {q.isPending ? (
        <Loading />
      ) : q.isError || !q.data ? (
        <ErrorState
          title={t("request.failedToLoad", "요청을 불러오지 못했습니다")}
          onRetry={() => q.refetch()}
          retryLabel={t("common.retry", "다시 시도")}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
          {(() => {
            const r = q.data;
            const status = statusMeta(r.status, t);
            return (
              <>
                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="font-display text-[22px] font-semibold text-forest-800">
                      {getRequestTitle(r, t)}
                    </Text>
                    <Badge label={status.label} tone={status.tone} />
                  </View>
                  <Text className="font-mono text-[11px] text-sage-400">#{r.publicId}</Text>
                </View>

                {r.status === "REJECTED" && r.rejectionReason ? (
                  <Card className="border-error-500 bg-error-50">
                    <Text className="font-display text-[14px] font-semibold text-error-700">
                      {t("request.rejectedTitle", "요청이 거절되었습니다")}
                    </Text>
                    <Text className="mt-1 text-[13px] text-error-600">{r.rejectionReason}</Text>
                  </Card>
                ) : null}

                <RequestFields request={r} />

                <View className="gap-3">
                  <Eyebrow>
                    {t("request.respondersTitle", "전문가 응답")} ({r.conversations?.length ?? 0})
                  </Eyebrow>
                  {(r.conversations?.length ?? 0) === 0 ? (
                    <Text className="text-[13px] text-sage-400">
                      {t("brokerIntros.noIntros", "아직 응답한 전문가가 없습니다.")}
                    </Text>
                  ) : (
                    r.conversations!.map((c) => <BrokerResponse key={c.id} convo={c} />)
                  )}
                </View>
              </>
            );
          })()}
        </ScrollView>
      )}
    </Screen>
  );
}

function BrokerResponse({ convo }: { convo: ConversationSummary }) {
  const { t } = useTranslation();
  const router = useRouter();
  const verified = convo.broker.verificationStatus === "VERIFIED";
  return (
    <Card
      onPress={() =>
        router.push({ pathname: "/(borrower)/messages/[id]", params: { id: convo.id } })
      }
    >
      <View className="flex-row items-center gap-3">
        <Avatar name={convo.broker.user.name} uri={convo.broker.profilePhoto} size={44} />
        <View className="flex-1">
          <Text className="font-display text-[15px] font-semibold text-forest-800">
            {convo.broker.brokerageName}
          </Text>
          <Text className="text-[12px] text-sage-500">{convo.broker.user.name}</Text>
        </View>
        {verified ? <Badge label={t("statusLabel.VERIFIED", "인증됨")} tone="success" /> : null}
      </View>
    </Card>
  );
}
