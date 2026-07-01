import { useMemo, useState, type ReactNode } from "react";
import { ScrollView, View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Screen, Header, Button, Input, Eyebrow } from "@/components/ui";
import { ChipGroup, Select } from "@/components/form";
import {
  productOptions,
  provinceOptions,
  timelineOptions,
  incomeOptions,
  categoryOptions,
} from "@/lib/requestOptions";
import { useCreateRequest } from "@/hooks/useRequests";
import { ApiError, type CreateRequestInput } from "@/api/client";

type Category = "RESIDENTIAL" | "COMMERCIAL";

export default function NewRequest() {
  const { t } = useTranslation();
  const router = useRouter();
  const create = useCreateRequest();

  const [category, setCategory] = useState<Category>("RESIDENTIAL");
  const [products, setProducts] = useState<string[]>([]);
  const [province, setProvince] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [timeline, setTimeline] = useState<string | null>(null);
  const [purposeOfUse, setPurposeOfUse] = useState<string[]>([]);
  const [incomeTypes, setIncomeTypes] = useState<string[]>([]);
  const [businessType, setBusinessType] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Switching category invalidates category-specific selections (like the web).
  function changeCategory(c: Category) {
    setCategory(c);
    setProducts([]);
    setPurposeOfUse([]);
    setIncomeTypes([]);
    setBusinessType("");
  }

  const productOpts = useMemo(() => productOptions(category, t), [category, t]);
  const purposeOpts = [
    { value: "OWNER_OCCUPIED", label: t("request.ownerOccupied", "실거주") },
    { value: "RENTAL", label: t("request.rental", "임대") },
  ];

  const baseValid = products.length > 0 && !!province;
  const resValid = category === "RESIDENTIAL" ? purposeOfUse.length > 0 && incomeTypes.length > 0 : true;
  const commValid =
    category === "COMMERCIAL" ? businessType.trim().length > 0 && notes.trim().length > 0 : true;
  const canSubmit = baseValid && resValid && commValid;

  function submit() {
    if (!canSubmit || !province) return;
    setError(null);
    const details =
      category === "RESIDENTIAL"
        ? { purposeOfUse, incomeTypes }
        : { businessType: businessType.trim() };
    const input: CreateRequestInput = {
      mortgageCategory: category,
      productTypes: products,
      province,
      city: city.trim() || undefined,
      desiredTimeline: timeline ?? undefined,
      notes: notes.trim() || undefined,
      details,
    };
    create.mutate(input, {
      onSuccess: (created) =>
        router.replace({ pathname: "/(borrower)/request/[id]", params: { id: created.publicId } }),
      onError: (err) => {
        if (err instanceof ApiError && err.body?.code === "ACTIVE_REQUEST_CAP") {
          setError(t("request.activeCapError", "활성 요청 수가 최대치에 도달했습니다. 기존 요청을 종료한 뒤 다시 시도해주세요."));
        } else {
          setError(t("errors.failedToSubmitRequest", "요청을 제출하지 못했습니다. 다시 시도해주세요."));
        }
      },
    });
  }

  return (
    <Screen>
      <Header title={t("request.newRequestTitle", "새 요청")} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 22 }} keyboardShouldPersistTaps="handled">
        <Field label={t("request.categoryQuestion", "어떤 종류의 요청인가요?")}>
          <ChipGroup
            options={categoryOptions(t)}
            value={[category]}
            onChange={(v) => changeCategory((v[0] as Category) ?? category)}
          />
        </Field>

        <Field label={t("request.selectProducts", "상품 유형")}>
          <ChipGroup options={productOpts} value={products} onChange={setProducts} multi />
        </Field>

        <Select
          label={t("request.province", "지역")}
          placeholder={t("request.province", "지역 선택")}
          options={provinceOptions()}
          value={province}
          onChange={setProvince}
        />

        <Input label={t("request.city", "도시 (선택)")} value={city} onChangeText={setCity} maxLength={100} />

        <Select
          label={t("request.desiredTimeline", "희망 시기")}
          placeholder={t("request.desiredTimeline", "시기 선택")}
          options={timelineOptions(t)}
          value={timeline}
          onChange={setTimeline}
        />

        {category === "RESIDENTIAL" ? (
          <>
            <Field label={t("request.purposeOfUse", "용도")}>
              <ChipGroup options={purposeOpts} value={purposeOfUse} onChange={setPurposeOfUse} multi />
            </Field>
            <Field label={t("request.incomeTypesLabel", "소득 유형")}>
              <ChipGroup options={incomeOptions(t)} value={incomeTypes} onChange={setIncomeTypes} multi />
            </Field>
            <Input
              label={t("request.additionalDetailsLabel", "추가 정보 (선택)")}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              className="h-[100px] py-3"
              style={{ textAlignVertical: "top" }}
              maxLength={4000}
            />
          </>
        ) : (
          <>
            <Input
              label={t("request.businessType", "사업자 유형")}
              value={businessType}
              onChangeText={setBusinessType}
              maxLength={100}
            />
            <Input
              label={t("request.additionalDetailsLabel", "추가 정보")}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              className="h-[100px] py-3"
              style={{ textAlignVertical: "top" }}
              maxLength={4000}
            />
          </>
        )}

        {error ? <Text className="text-[13px] text-error-600">{error}</Text> : null}

        <Button
          title={t("request.submit", "요청 제출")}
          variant="gold"
          onPress={submit}
          loading={create.isPending}
          disabled={!canSubmit}
        />
      </ScrollView>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Eyebrow>{label}</Eyebrow>
      {children}
    </View>
  );
}
