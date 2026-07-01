import { useState } from "react";
import { ScrollView, View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Screen, Header, Input, Button, Badge, Eyebrow } from "@/components/ui";
import { Loading, ErrorState } from "@/components/states";
import { ChipGroup, Select } from "@/components/form";
import { provinceOptions } from "@/lib/requestOptions";
import { useBrokerProfile, useUpdateBrokerProfile } from "@/hooks/useBroker";
import { ApiError, type BrokerProfile } from "@/api/client";

export default function BrokerProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const q = useBrokerProfile();

  const header = <Header title={t("broker.nav.profile", "프로필")} onBack={() => router.back()} />;

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
          title={t("broker.failedToLoadRequests", "불러오지 못했습니다")}
          onRetry={() => q.refetch()}
          retryLabel={t("common.retry", "다시 시도")}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      <ProfileForm profile={q.data} />
    </Screen>
  );
}

function ProfileForm({ profile }: { profile: BrokerProfile }) {
  const { t } = useTranslation();
  const save = useUpdateBrokerProfile();

  const [brokerageName, setBrokerageName] = useState(profile.brokerageName);
  const [province, setProvince] = useState<string | null>(profile.province);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [licenseNumber, setLicenseNumber] = useState(profile.licenseNumber ?? "");
  const [years, setYears] = useState(profile.yearsExperience != null ? String(profile.yearsExperience) : "");
  const [category, setCategory] = useState(profile.mortgageCategory ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [areasServed, setAreasServed] = useState(profile.areasServed ?? "");
  const [specialties, setSpecialties] = useState(profile.specialties ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSave = brokerageName.trim().length > 0 && !!province;

  function onSave() {
    if (!canSave || !province) return;
    setMsg(null);
    setError(null);
    const yearsNum = years.trim() ? Number(years) : null;
    save.mutate(
      {
        brokerageName: brokerageName.trim(),
        province,
        phone: phone.trim() || undefined,
        licenseNumber: licenseNumber.trim() || undefined,
        bio: bio.trim() || undefined,
        areasServed: areasServed.trim() || undefined,
        specialties: specialties.trim() || undefined,
        yearsExperience: Number.isFinite(yearsNum) ? yearsNum : null,
        mortgageCategory: category || undefined,
      },
      {
        onSuccess: () => setMsg(t("broker.saved", "저장되었습니다.")),
        onError: (e) =>
          setError(e instanceof ApiError && e.status === 400 ? e.code : t("broker.saveFailed", "저장하지 못했습니다.")),
      },
    );
  }

  const categoryOpts = [
    { value: "RESIDENTIAL", label: t("broker.residential", "주거용") },
    { value: "COMMERCIAL", label: t("broker.commercial", "상업용") },
    { value: "BOTH", label: t("broker.both", "전체") },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }} keyboardShouldPersistTaps="handled">
      <View className="flex-row items-center gap-2">
        <Badge
          label={t(`status.${profile.verificationStatus.toLowerCase()}`, profile.verificationStatus)}
          tone={profile.verificationStatus === "VERIFIED" ? "success" : profile.verificationStatus === "REJECTED" ? "error" : "gold"}
        />
        <Badge label={profile.subscriptionTier} tone={profile.subscriptionTier === "PREMIUM" ? "gold" : "neutral"} />
        <Text className="font-mono text-[11px] text-sage-400">{profile.user.email}</Text>
      </View>

      <Input label={t("broker.brokerageName", "상호명")} value={brokerageName} onChangeText={setBrokerageName} maxLength={200} />

      <Select
        label={t("request.province", "지역")}
        placeholder={t("request.province", "지역 선택")}
        options={provinceOptions()}
        value={province}
        onChange={setProvince}
      />

      <View className="gap-2">
        <Eyebrow>{t("broker.mortgageCategory", "취급 분야")}</Eyebrow>
        <ChipGroup options={categoryOpts} value={category ? [category] : []} onChange={(v) => setCategory(v[0] ?? "")} />
      </View>

      <Input label={t("broker.phone", "전화번호")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
      <Input label={t("broker.licenseNumber", "라이선스 번호")} value={licenseNumber} onChangeText={setLicenseNumber} autoCapitalize="characters" maxLength={50} />
      <Input label={t("broker.yearsExperience", "경력 (년)")} value={years} onChangeText={setYears} keyboardType="number-pad" maxLength={3} />
      <Input
        label={t("broker.bio", "소개")}
        value={bio}
        onChangeText={setBio}
        multiline
        className="h-[100px] py-3"
        style={{ textAlignVertical: "top" }}
        maxLength={2000}
      />
      <Input label={t("broker.areasServed", "서비스 지역")} value={areasServed} onChangeText={setAreasServed} maxLength={1000} />
      <Input label={t("broker.specialties", "전문 분야")} value={specialties} onChangeText={setSpecialties} maxLength={1000} />

      {msg ? <Text className="text-[13px] text-success-700">{msg}</Text> : null}
      {error ? <Text className="text-[13px] text-error-600">{error}</Text> : null}

      <Button
        title={t("broker.save", "저장")}
        variant="gold"
        onPress={onSave}
        loading={save.isPending}
        disabled={!canSave}
      />
    </ScrollView>
  );
}
