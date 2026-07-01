import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import {
  PRODUCT_LABEL_KEYS,
  INCOME_TYPE_LABEL_KEYS,
  TIMELINE_LABEL_KEYS,
} from "@mortly/core/requestConfig";
import type { BorrowerRequest } from "@/api/client";

/** Read-only request field block, shared by the borrower + broker detail screens. */
export function RequestFields({ request }: { request: BorrowerRequest }) {
  const { t } = useTranslation();
  const details = (request.details ?? {}) as Record<string, unknown>;
  const products = request.productTypes.map((p) => t(PRODUCT_LABEL_KEYS[p] ?? p, p)).join(", ");
  const purpose = Array.isArray(details.purposeOfUse)
    ? (details.purposeOfUse as string[])
        .map((v) => (v === "OWNER_OCCUPIED" ? t("request.ownerOccupied", "실거주") : t("request.rental", "임대")))
        .join(", ")
    : null;
  const incomes = Array.isArray(details.incomeTypes)
    ? (details.incomeTypes as string[]).map((v) => t(INCOME_TYPE_LABEL_KEYS[v] ?? v, v)).join(", ")
    : null;

  return (
    <View className="gap-3 rounded-sm border border-cream-300 bg-cream-50 p-4">
      <Row label={t("request.selectProducts", "상품")} value={products} />
      <Row label={t("request.province", "지역")} value={[request.city, request.province].filter(Boolean).join(", ")} />
      {request.desiredTimeline ? (
        <Row
          label={t("request.desiredTimeline", "희망 시기")}
          value={t(TIMELINE_LABEL_KEYS[request.desiredTimeline] ?? request.desiredTimeline, request.desiredTimeline)}
        />
      ) : null}
      {purpose ? <Row label={t("request.purposeOfUse", "용도")} value={purpose} /> : null}
      {incomes ? <Row label={t("request.incomeTypesLabel", "소득 유형")} value={incomes} /> : null}
      {typeof details.businessType === "string" && details.businessType ? (
        <Row label={t("request.businessType", "사업자 유형")} value={details.businessType} />
      ) : null}
      {request.notes ? <Row label={t("request.additionalDetailsLabel", "추가 정보")} value={request.notes} /> : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5">
      <Text className="font-mono text-[10px] uppercase tracking-[0.12em] text-sage-400">{label}</Text>
      <Text className="text-[14px] leading-5 text-forest-800">{value}</Text>
    </View>
  );
}
