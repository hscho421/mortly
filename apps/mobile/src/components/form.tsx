import { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";

/**
 * Form selection primitives (Midnight & Gold). Expo-Go-safe (RN core Modal +
 * Pressable — no extra native deps).
 */

export interface Option<T extends string> {
  value: T;
  label: string;
}

/** Toggleable pills — `multi` for multi-select, else single-select. */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: Option<T>[];
  value: T[];
  onChange: (next: T[]) => void;
  multi?: boolean;
}) {
  function toggle(v: T) {
    if (multi) {
      onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
    } else {
      onChange([v]);
    }
  }
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const sel = value.includes(o.value);
        return (
          <Pressable
            key={o.value}
            onPress={() => toggle(o.value)}
            accessibilityRole={multi ? "checkbox" : "radio"}
            accessibilityState={multi ? { checked: sel } : { selected: sel }}
            className={`rounded-sm border px-3 py-2 ${sel ? "border-amber-500 bg-amber-50" : "border-cream-300 bg-cream-50"}`}
          >
            <Text className={`text-[13px] ${sel ? "font-semibold text-forest-800" : "text-sage-600"}`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Single-select via a bottom-sheet modal list — good for long lists (provinces). */
export function Select<T extends string>({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label?: string;
  placeholder: string;
  options: Option<T>[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View className="gap-1.5">
      {label ? (
        <Text className="font-display text-[13px] font-medium text-forest-700">{label}</Text>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        className="h-[52px] flex-row items-center justify-between rounded-sm border border-cream-300 bg-cream-50 px-4"
      >
        <Text className={`text-[16px] ${current ? "text-forest-900" : "text-sage-400"}`}>
          {current?.label ?? placeholder}
        </Text>
        <Text className="text-[14px] text-sage-400">⌄</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <Pressable className="absolute inset-0" onPress={() => setOpen(false)} accessibilityLabel="Close" />
          <View className="max-h-[70%] rounded-t-sm bg-cream-50 pb-8">
            <View className="border-b border-cream-200 p-4">
              <Text className="font-display text-[16px] font-semibold text-forest-800">
                {label ?? placeholder}
              </Text>
            </View>
            <ScrollView>
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex-row items-center justify-between border-b border-cream-100 px-4 py-4 ${o.value === value ? "bg-amber-50" : ""}`}
                >
                  <Text className="text-[16px] text-forest-800">{o.label}</Text>
                  {o.value === value ? <Text className="text-amber-600">✓</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
