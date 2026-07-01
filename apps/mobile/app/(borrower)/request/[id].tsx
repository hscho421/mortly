import { ScrollView, View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getRequestTitle,
  PRODUCT_LABEL_KEYS,
  INCOME_TYPE_LABEL_KEYS,
  TIMELINE_LABEL_KEYS,
} from "@mortly/core/requestConfig";
import { Screen, Header, Badge, Card, Avatar, Eyebrow } from "@/components/ui";
import { Loading, ErrorState } from "@/components/states";
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
            const details = (r.details ?? {}) as Record<string, unknown>;
            const products = r.productTypes.map((p) => t(PRODUCT_LABEL_KEYS[p] ?? p, p)).join(", ");
            const purpose = Array.isArray(details.purposeOfUse)
              ? (details.purposeOfUse as string[])
                  .map((v) => (v === "OWNER_OCCUPIED" ? t("request.ownerOccupied", "실거주") : t("request.rental", "임대")))
                  .join(", ")
              : null;
            const incomes = Array.isArray(details.incomeTypes)
              ? (details.incomeTypes as string[]).map((v) => t(INCOME_TYPE_LABEL_KEYS[v] ?? v, v)).join(", ")
              : null;
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

                <View className="gap-3 rounded-sm border border-cream-300 bg-cream-50 p-4">
                  <DetailRow label={t("request.selectProducts", "상품")} value={products} />
                  <DetailRow
                    label={t("request.province", "지역")}
                    value={[r.city, r.province].filter(Boolean).join(", ")}
                  />
                  {r.desiredTimeline ? (
                    <DetailRow
                      label={t("request.desiredTimeline", "희망 시기")}
                      value={t(TIMELINE_LABEL_KEYS[r.desiredTimeline] ?? r.desiredTimeline, r.desiredTimeline)}
                    />
                  ) : null}
                  {purpose ? <DetailRow label={t("request.purposeOfUse", "용도")} value={purpose} /> : null}
                  {incomes ? <DetailRow label={t("request.incomeTypesLabel", "소득 유형")} value={incomes} /> : null}
                  {typeof details.businessType === "string" && details.businessType ? (
                    <DetailRow label={t("request.businessType", "사업자 유형")} value={details.businessType} />
                  ) : null}
                  {r.notes ? <DetailRow label={t("request.additionalDetailsLabel", "추가 정보")} value={r.notes} /> : null}
                </View>

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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5">
      <Text className="font-mono text-[10px] uppercase tracking-[0.12em] text-sage-400">{label}</Text>
      <Text className="text-[14px] leading-5 text-forest-800">{value}</Text>
    </View>
  );
}

function BrokerResponse({ convo }: { convo: ConversationSummary }) {
  const { t } = useTranslation();
  const verified = convo.broker.verificationStatus === "VERIFIED";
  return (
    <Card>
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
