import { View, Text, ActivityIndicator } from "react-native";
import { Button } from "@/components/ui";

/** Shared loading / empty / error states (plan §3). */

export function Loading({ label }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3">
      <ActivityIndicator color="#c49a3a" size="large" />
      {label ? <Text className="text-[13px] text-sage-400">{label}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-2 px-8">
      <View className="mb-1 h-12 w-12 items-center justify-center rounded-sm bg-cream-200">
        <Text className="text-[20px] text-sage-300">◦</Text>
      </View>
      <Text className="text-center font-display text-[17px] font-semibold text-forest-800">{title}</Text>
      {subtitle ? (
        <Text className="text-center text-[13px] leading-5 text-sage-400">{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = "다시 시도",
}: {
  title: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8">
      <Text className="text-center font-display text-[17px] font-semibold text-error-700">{title}</Text>
      {message ? (
        <Text className="text-center text-[13px] leading-5 text-sage-500">{message}</Text>
      ) : null}
      {onRetry ? (
        <View className="mt-2 w-44">
          <Button title={retryLabel} variant="light" size="sm" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}
