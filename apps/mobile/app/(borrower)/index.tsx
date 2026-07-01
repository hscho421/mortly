import { View, Text, Pressable, FlatList } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Screen, Header, Button } from "@/components/ui";
import { Loading, EmptyState, ErrorState } from "@/components/states";
import { RequestCard } from "@/components/RequestCard";
import { useMyRequests } from "@/hooks/useRequests";

export default function BorrowerHome() {
  const { t } = useTranslation();
  const router = useRouter();
  const q = useMyRequests();

  const openNew = () => router.push("/(borrower)/new-request");

  return (
    <Screen>
      <Header
        title={t("borrower.nav.dashboard", "내 요청")}
        right={
          <Pressable accessibilityRole="button" onPress={() => router.push("/account")} hitSlop={8}>
            <Text className="text-[13px] text-sage-500">{t("account.title", "계정")}</Text>
          </Pressable>
        }
      />

      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState
          title={t("borrowerDashboard.failedToLoadTitle", "불러오지 못했습니다")}
          message={t("borrowerDashboard.failedToLoad", "요청을 불러오지 못했습니다.")}
          onRetry={() => q.refetch()}
          retryLabel={t("common.retry", "다시 시도")}
        />
      ) : (q.data?.length ?? 0) === 0 ? (
        <View className="flex-1">
          <EmptyState
            title={t("borrowerDashboard.noRequests", "아직 요청이 없습니다")}
            subtitle={t("borrowerDashboard.noRequestsDesc", "첫 요청을 만들어 모기지 전문가와 연결되세요.")}
          />
          <View className="px-6 pb-8">
            <Button
              title={t("borrowerDashboard.createFirst", "첫 요청 만들기")}
              variant="gold"
              onPress={openNew}
            />
          </View>
        </View>
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          ListHeaderComponent={
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  title={t("borrower.nav.messages", "메시지")}
                  variant="light"
                  onPress={() => router.push("/(borrower)/messages")}
                />
              </View>
              <View className="flex-1">
                <Button title={t("borrowerDashboard.newRequest", "+ 새 요청")} variant="gold" onPress={openNew} />
              </View>
            </View>
          }
          renderItem={({ item }) => <RequestCard request={item} />}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
        />
      )}
    </Screen>
  );
}
