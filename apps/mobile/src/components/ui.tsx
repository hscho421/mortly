import {
  Pressable,
  Text,
  View,
  TextInput,
  Image,
  ActivityIndicator,
  type PressableProps,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, type ReactNode } from "react";

/**
 * Midnight & Gold design-system primitives (plan §3). NativeWind classes resolve
 * to the shared @mortly/core palette. Conventions: sharp corners (rounded-sm),
 * gold accent, ≥44pt touch targets, safe-area aware.
 */

// ─── Screen ────────────────────────────────────────────────────────────────
export function Screen({
  children,
  className = "",
  edges = ["top", "bottom"],
}: {
  children: ReactNode;
  className?: string;
  edges?: ("top" | "bottom" | "left" | "right")[];
}) {
  return (
    <SafeAreaView className="flex-1 bg-cream-100" edges={edges}>
      <View className={`flex-1 ${className}`}>{children}</View>
    </SafeAreaView>
  );
}

// ─── Button ──────────────────────────────────────────────────────────────────
type Variant = "primary" | "gold" | "light" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  sm: "h-[40px] px-3",
  md: "h-[52px] px-4",
  lg: "h-[56px] px-5",
};
const VARIANTS: Record<Variant, string> = {
  primary: "bg-forest-800",
  gold: "bg-amber-500",
  light: "bg-cream-50 border border-cream-300",
  ghost: "bg-transparent",
  destructive: "bg-error-600",
};
const LABELS: Record<Variant, string> = {
  primary: "text-cream-50",
  gold: "text-forest-900",
  light: "text-forest-800",
  ghost: "text-forest-700",
  destructive: "text-white",
};

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  ...rest
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
} & Omit<PressableProps, "onPress" | "disabled">) {
  const isDisabled = disabled || loading;
  const dark = variant === "primary" || variant === "destructive" || variant === "ghost";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      className={`flex-row items-center justify-center rounded-sm ${SIZES[size]} ${VARIANTS[variant]} ${isDisabled ? "opacity-50" : ""}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={dark ? "#fefefe" : "#0f1729"} />
      ) : (
        <Text
          className={`font-display font-semibold ${size === "sm" ? "text-[14px]" : "text-[16px]"} ${LABELS[variant]}`}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
export function Input({
  label,
  error,
  hint,
  className = "",
  ...rest
}: {
  label?: string;
  error?: string | null;
  hint?: string;
} & TextInputProps) {
  const [focused, setFocused] = useState(false);
  const border = error ? "border-error-500" : focused ? "border-amber-500" : "border-cream-300";
  return (
    <View className="gap-1.5">
      {label ? (
        <Text className="font-display text-[13px] font-medium text-forest-700">{label}</Text>
      ) : null}
      <TextInput
        className={`h-[52px] rounded-sm border bg-cream-50 px-4 text-[16px] text-forest-900 ${border} ${className}`}
        placeholderTextColor="#9ea6bd"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...rest}
      />
      {error ? (
        <Text className="text-[12px] text-error-600">{error}</Text>
      ) : hint ? (
        <Text className="text-[12px] text-sage-400">{hint}</Text>
      ) : null}
    </View>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({
  children,
  onPress,
  className = "",
}: {
  children: ReactNode;
  onPress?: () => void;
  className?: string;
}) {
  const base = `rounded-sm border border-cream-300 bg-cream-50 p-4 ${className}`;
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} className={`${base} active:opacity-80`}>
        {children}
      </Pressable>
    );
  }
  return <View className={base}>{children}</View>;
}

// ─── Badge / Pill ─────────────────────────────────────────────────────────────
type Tone = "neutral" | "gold" | "success" | "error" | "info";
const TONES: Record<Tone, string> = {
  neutral: "bg-sage-100",
  gold: "bg-amber-100",
  success: "bg-success-100",
  error: "bg-error-100",
  info: "bg-info-100",
};
const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-sage-600",
  gold: "text-amber-700",
  success: "text-success-700",
  error: "text-error-700",
  info: "text-info-700",
};
export function Badge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <View className={`self-start rounded-sm px-2 py-1 ${TONES[tone]}`}>
      <Text className={`font-mono text-[10px] uppercase tracking-[0.1em] ${TONE_TEXT[tone]}`}>
        {label}
      </Text>
    </View>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({
  name,
  uri,
  size = 40,
}: {
  name?: string | null;
  uri?: string | null;
  size?: number;
}) {
  const initials = (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <View
      className="items-center justify-center rounded-sm bg-forest-700"
      style={{ width: size, height: size }}
    >
      {uri ? (
        <Image source={{ uri }} className="h-full w-full rounded-sm" />
      ) : (
        <Text className="font-display font-semibold text-cream-50" style={{ fontSize: size * 0.4 }}>
          {initials || "·"}
        </Text>
      )}
    </View>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
export function Header({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View className="h-[52px] flex-row items-center justify-between border-b border-cream-200 px-4">
      <View className="w-10">
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={8}>
            <Text className="text-[22px] text-forest-700">‹</Text>
          </Pressable>
        ) : null}
      </View>
      <Text className="font-display text-[16px] font-semibold text-forest-800">{title}</Text>
      <View className="w-10 items-end">{right}</View>
    </View>
  );
}

// ─── Eyebrow ──────────────────────────────────────────────────────────────────
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Text className="font-mono text-[10px] uppercase tracking-[0.16em] text-sage-400">{children}</Text>
  );
}
