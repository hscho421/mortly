import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { getRequestTitle } from "@mortly/core/requestConfig";
import { Card, Badge } from "@/components/ui";
import { statusMeta } from "@/lib/requestStatus";
import type { BorrowerRequest } from "@/api/client";

export function RequestCard({ request }: { request: BorrowerRequest }) {
  const { t } = useTranslation();
  const router = useRouter();
  const status = statusMeta(request.status, t);
  const responses = request._count?.conversations ?? 0;
  const location = [request.city, request.province].filter(Boolean).join(", ");

  return (
    <Card
      onPress={() =>
        router.push({ pathname: "/(borrower)/request/[id]", params: { id: request.publicId } })
      }
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 font-display text-[16px] font-semibold text-forest-800">
          {getRequestTitle(request, t)}
        </Text>
        <Badge label={status.label} tone={status.tone} />
      </View>
      {location ? <Text className="mt-1 text-[13px] text-sage-500">{location}</Text> : null}
      <View className="mt-3 flex-row items-center gap-4">
        <Text className="font-mono text-[11px] text-sage-400">
          {t("borrower.responses", "응답")} {responses}
        </Text>
        <Text className="font-mono text-[11px] text-sage-400">#{request.publicId}</Text>
      </View>
    </Card>
  );
}
