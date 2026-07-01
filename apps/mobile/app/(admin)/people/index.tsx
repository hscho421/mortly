import { useState } from "react";
import { View, Text, TextInput, FlatList, Alert, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Screen, Header, Card, Button, Badge, Avatar } from "@/components/ui";
import { Loading, EmptyState, ErrorState } from "@/components/states";
import { ChipGroup } from "@/components/form";
import { useAdminUsers, useModerateUser } from "@/hooks/useAdmin";
import { useAuth } from "@/auth/AuthContext";
import type { AdminUser } from "@/api/client";

const USER_TONE: Record<string, "success" | "gold" | "error"> = {
  ACTIVE: "success",
  SUSPENDED: "gold",
  BANNED: "error",
};

export default function AdminPeople() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = useAdminUsers({ search: search || undefined, status: status || undefined });
  const mod = useModerateUser();
  const users = q.data?.pages.flatMap((p) => p.data) ?? [];

  const confirm = (msg: string, onYes: () => void) =>
    Alert.alert(msg, "", [
      { text: t("request.cancel", "취소"), style: "cancel" },
      { text: t("common.confirm", "확인"), style: "destructive", onPress: onYes },
    ]);

  const act = (id: string, status: string, msg: string) =>
    confirm(msg, () => {
      setBusyId(id);
      mod.mutate({ id, status }, { onSettled: () => setBusyId(null) });
    });

  const statusOpts = [
    { value: "", label: t("admin.allStatuses", "전체") },
    { value: "ACTIVE", label: t("status.active", "활성") },
    { value: "SUSPENDED", label: t("status.suspended", "정지") },
    { value: "BANNED", label: t("status.banned", "차단") },
  ];

  return (
    <Screen>
      <Header title={t("admin.nav.people", "사용자")} onBack={() => router.back()} />

      <View className="gap-3 border-b border-cream-200 p-4">
        <TextInput
          className="h-[44px] rounded-sm border border-cream-300 bg-cream-50 px-3 text-[15px] text-forest-900"
          placeholder={t("admin.searchPlaceholder", "이름, 이메일, ID 검색")}
          placeholderTextColor="#9ea6bd"
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={() => setSearch(input.trim())}
        />
        <ChipGroup options={statusOpts} value={[status]} onChange={(v) => setStatus(v[0] ?? "")} />
      </View>

      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState
          title={t("admin.people.loadFailed", "불러오지 못했습니다")}
          onRetry={() => q.refetch()}
          retryLabel={t("common.retry", "다시 시도")}
        />
      ) : users.length === 0 ? (
        <EmptyState title={t("admin.people.empty", "사용자가 없습니다")} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
          }}
          ListFooterComponent={
            q.isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator color="#c49a3a" />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <UserRow
              u={item}
              isSelf={item.id === user?.id}
              busy={busyId === item.id}
              onSuspend={() => act(item.id, "SUSPENDED", t("admin.suspendUser", "이 사용자를 정지하시겠습니까?"))}
              onBan={() => act(item.id, "BANNED", t("admin.banUser", "이 사용자를 차단하시겠습니까?"))}
              onReactivate={() => act(item.id, "ACTIVE", t("admin.reactivate", "이 사용자를 재활성화하시겠습니까?"))}
            />
          )}
        />
      )}
    </Screen>
  );
}

function UserRow({
  u,
  isSelf,
  busy,
  onSuspend,
  onBan,
  onReactivate,
}: {
  u: AdminUser;
  isSelf: boolean;
  busy: boolean;
  onSuspend: () => void;
  onBan: () => void;
  onReactivate: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const isAdmin = u.role === "ADMIN";
  const active = u.status === "ACTIVE";
  return (
    <Card onPress={() => router.push({ pathname: "/(admin)/user/[id]", params: { id: u.id } })}>
      <View className="flex-row items-center gap-3">
        <Avatar name={u.name} size={40} />
        <View className="flex-1">
          <Text className="font-display text-[15px] font-semibold text-forest-800" numberOfLines={1}>
            {u.name ?? u.email}
          </Text>
          <Text className="text-[12px] text-sage-500" numberOfLines={1}>
            {u.email} · #{u.publicId}
          </Text>
        </View>
        <Badge label={t(`status.${u.status.toLowerCase()}`, u.status)} tone={USER_TONE[u.status] ?? "neutral"} />
      </View>

      {isAdmin || isSelf ? (
        <Text className="mt-3 font-mono text-[11px] text-sage-400">
          {isSelf ? t("admin.self", "내 계정") : t("admin.adminAccount", "관리자 계정")}
        </Text>
      ) : (
        <View className="mt-3 flex-row gap-2">
          {active ? (
            <>
              <View className="flex-1">
                <Button title={t("admin.suspend", "정지")} variant="light" size="sm" disabled={busy} onPress={onSuspend} />
              </View>
              <View className="flex-1">
                <Button
                  title={t("admin.ban", "차단")}
                  variant="destructive"
                  size="sm"
                  loading={busy}
                  disabled={busy}
                  onPress={onBan}
                />
              </View>
            </>
          ) : (
            <View className="flex-1">
              <Button
                title={t("admin.reactivate", "재활성화")}
                variant="gold"
                size="sm"
                loading={busy}
                disabled={busy}
                onPress={onReactivate}
              />
            </View>
          )}
        </View>
      )}
    </Card>
  );
}
