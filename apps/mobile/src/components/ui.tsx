import { Pressable, Text, View, ActivityIndicator, type PressableProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";

/**
 * Base design-system primitives (Midnight & Gold). Styled with NativeWind
 * classes that resolve to the shared @mortly/core tokens. Sharp corners
 * (rounded-sm), gold accent, ≥44pt touch targets — the seed of §3 of the plan.
 */

export function Screen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <SafeAreaView className="flex-1 bg-cream-100" edges={["top", "bottom"]}>
      <View className={`flex-1 ${className}`}>{children}</View>
    </SafeAreaView>
  );
}

type Variant = "primary" | "gold" | "light" | "ghost";
const BASE = "h-[52px] rounded-sm items-center justify-center flex-row px-4";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-forest-800",
  gold: "bg-amber-500",
  light: "bg-cream-50 border border-cream-300",
  ghost: "bg-transparent",
};
const LABELS: Record<Variant, string> = {
  primary: "text-cream-50",
  gold: "text-forest-900",
  light: "text-forest-800",
  ghost: "text-forest-700",
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  ...rest
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
} & Omit<PressableProps, "onPress" | "disabled">) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      className={`${BASE} ${VARIANTS[variant]} ${isDisabled ? "opacity-50" : ""}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "gold" || variant === "light" ? "#0f1729" : "#fefefe"} />
      ) : (
        <Text className={`font-display font-semibold text-[16px] ${LABELS[variant]}`}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Text className="font-mono text-[10px] uppercase tracking-[0.16em] text-sage-400">{children}</Text>
  );
}
