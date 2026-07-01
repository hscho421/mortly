import { ScrollView, View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Screen, Header, Button, Card, Badge, Eyebrow } from "@/components/ui";
import { Loading } from "@/components/states";
import { useBrokerProfile } from "@/hooks/useBroker";
import { ApiError } from "@/api/client";

const LAPSED = ["PAST_DUE", "EXPIRED", "CANCELLED"];

export default function BrokerHome() {
  const { t } = useTranslation();
  const router = useRouter();
  const q = useBrokerProfile();

  const header = (
    <Header
      title={t("broker.nav.dashboard", "대시보드")}
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
    const noProfile = q.error instanceof ApiError && q.error.status === 404;
    return (
      <Screen>
        {header}
        <View className="flex-1 justify-center gap-3 px-6">
          <Card>
            <Text className="font-display text-[17px] font-semibold text-forest-800">
              {noProfile ? t("broker.onboardingTitle", "프로필을 완성하세요") : t("broker.failedToLoadRequests", "불러오지 못했습니다")}
            </Text>
            <Text className="mt-2 text-[13px] leading-5 text-sage-500">
              {noProfile
                ? t("broker.onboardingSubtitle", "브로커 프로필은 웹(mortly.ca)에서 완성할 수 있습니다. 로그인 후 온보딩을 마치면 앱에서 요청을 확인할 수 있습니다.")
                : ""}
            </Text>
          </Card>
          {!noProfile ? (
            <Button title={t("common.retry", "다시 시도")} variant="light" onPress={() => q.refetch()} />
          ) : null}
        </View>
      </Screen>
    );
  }

  const p = q.data;
  const verified = p.verificationStatus === "VERIFIED";

  if (!verified) {
    const rejected = p.verificationStatus === "REJECTED";
    return (
      <Screen>
        {header}
        <View className="flex-1 justify-center gap-3 px-6">
          <Badge
            label={t(`status.${p.verificationStatus.toLowerCase()}`, p.verificationStatus)}
            tone={rejected ? "error" : "gold"}
          />
          <Text className="font-display text-[20px] font-semibold text-forest-800">
            {rejected ? t("broker.rejectedTitle", "인증이 거절되었습니다") : t("broker.pendingTitle", "인증 검토 중")}
          </Text>
          <Text className="text-[14px] leading-5 text-sage-500">
            {rejected
              ? t("broker.rejectedDesc", "자세한 내용은 지원팀에 문의해주세요.")
              : t("broker.pendingDesc", "프로필 인증을 검토하고 있습니다. 승인되면 요청을 확인할 수 있습니다.")}
          </Text>
        </View>
      </Screen>
    );
  }

  const unlimited = p.subscriptionTier === "PREMIUM" && p.subscription?.status === "ACTIVE";
  const pastDue = !!p.subscription?.status && LAPSED.includes(p.subscription.status);

  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View className="gap-2">
          <Eyebrow>{p.brokerageName}</Eyebrow>
          <View className="flex-row items-center gap-2">
            <Badge label={p.subscriptionTier} tone={p.subscriptionTier === "PREMIUM" ? "gold" : "neutral"} />
            <Text className="font-mono text-[12px] text-sage-500">
              {unlimited
                ? t("broker.unlimited", "무제한")
                : `${t("broker.responseCredits", "크레딧")} ${p.responseCredits}`}
            </Text>
            {pastDue ? <Badge label={t("status.pastDue", "연체")} tone="error" /> : null}
          </View>
        </View>

        <Button
          title={t("broker.browseRequests", "요청 찾기")}
          variant="gold"
          onPress={() => router.push("/(broker)/requests")}
        />
        <Button
          title={t("broker.nav.messages", "메시지")}
          variant="light"
          onPress={() => router.push("/(broker)/messages")}
        />
        <Button
          title={t("broker.nav.profile", "프로필")}
          variant="light"
          onPress={() => router.push("/(broker)/profile")}
        />
      </ScrollView>
    </Screen>
  );
}
