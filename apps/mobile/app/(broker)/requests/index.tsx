import { useState } from "react";
import { View, Text, FlatList } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { getRequestTitle, TIMELINE_LABEL_KEYS } from "@mortly/core/requestConfig";
import { Screen, Header, Card, Badge } from "@/components/ui";
import { Loading, EmptyState, ErrorState } from "@/components/states";
import { Select, ChipGroup } from "@/components/form";
import { provinceOptions, categoryOptions } from "@/lib/requestOptions";
import { useBrokerFeed } from "@/hooks/useBroker";
import type { BrokerFeedRequest } from "@/api/client";

export default function BrokerFeed() {
  const { t } = useTranslation();
  const router = useRouter();
  const [province, setProvince] = useState<string>("");
  const [category, setCategory] = useState<string>("");

  const q = useBrokerFeed({
    province: province || undefined,
    mortgageCategory: category || undefined,
  });

  const provinceOpts = [{ value: "", label: t("broker.allProvinces", "전체 지역") }, ...provinceOptions()];
  const categoryOpts = [{ value: "", label: t("broker.allTypes", "전체") }, ...categoryOptions(t)];

  return (
    <Screen>
      <Header title={t("broker.browseRequests", "요청 찾기")} onBack={() => router.back()} />

      <View className="gap-3 border-b border-cream-200 p-4">
        <Select
          placeholder={t("broker.allProvinces", "전체 지역")}
          options={provinceOpts}
          value={province || null}
          onChange={setProvince}
        />
        <ChipGroup options={categoryOpts} value={[category]} onChange={(v) => setCategory(v[0] ?? "")} />
      </View>

      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState
          title={t("broker.failedToLoadRequests", "요청을 불러오지 못했습니다")}
          onRetry={() => q.refetch()}
          retryLabel={t("common.retry", "다시 시도")}
        />
      ) : q.data.data.length === 0 ? (
        <EmptyState
          title={t("broker.noMatchingRequests", "요청이 없습니다")}
          subtitle={t("broker.noMatchingRequestsDesc", "필터를 변경하거나 나중에 다시 확인해보세요.")}
        />
      ) : (
        <FlatList
          data={q.data.data}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          renderItem={({ item }) => (
            <FeedCard
              item={item}
              onPress={() =>
                router.push({ pathname: "/(broker)/requests/[id]", params: { id: item.publicId } })
              }
            />
          )}
        />
      )}
    </Screen>
  );
}

function FeedCard({ item, onPress }: { item: BrokerFeedRequest; onPress: () => void }) {
  const { t } = useTranslation();
  const responses = item._count?.conversations ?? 0;
  const location = [item.city, item.province].filter(Boolean).join(", ");
  return (
    <Card onPress={onPress}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 flex-row items-center gap-2">
          {item.isNew ? <View className="h-2 w-2 rounded-full bg-amber-500" /> : null}
          <Text className="flex-1 font-display text-[15px] font-semibold text-forest-800">
            {getRequestTitle(item, t)}
          </Text>
        </View>
        {item.isPremiumExclusive ? (
          <Badge label={t("broker.premiumExclusiveBadge", "프리미엄")} tone="gold" />
        ) : item.hasMyConversation ? (
          <Badge label={t("broker.alreadyMessaged", "응답함")} tone="success" />
        ) : null}
      </View>
      {location ? <Text className="mt-1 text-[13px] text-sage-500">{location}</Text> : null}
      <View className="mt-2 flex-row items-center gap-4">
        <Text className="font-mono text-[11px] text-sage-400">
          {responses > 0
            ? `${t("broker.responsesSuffix", "응답")} ${responses}`
            : t("broker.openForResponse", "오픈")}
        </Text>
        {item.desiredTimeline ? (
          <Text className="font-mono text-[11px] text-sage-400">
            {t(TIMELINE_LABEL_KEYS[item.desiredTimeline] ?? item.desiredTimeline, item.desiredTimeline)}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
