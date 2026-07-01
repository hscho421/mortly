import { useState, type ReactNode } from "react";
import { ScrollView, View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Header, Button, Input, Card, Badge, Avatar, Eyebrow } from "@/components/ui";
import { EmptyState, ErrorState } from "@/components/states";

/**
 * Dev reference screen — every design-system primitive in every state (plan §3).
 * Reachable in dev from the role home; exempt from the auth router.
 */
export default function KitchenSink() {
  const router = useRouter();
  const [text, setText] = useState("");

  return (
    <Screen>
      <Header title="Kitchen Sink" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 24, gap: 28 }}>
        <Section title="Buttons">
          <Button title="Primary" />
          <Button title="Gold" variant="gold" />
          <Button title="Light" variant="light" />
          <Button title="Ghost" variant="ghost" />
          <Button title="Destructive" variant="destructive" />
          <Button title="Loading" loading />
          <Button title="Disabled" disabled />
          <Button title="Small" size="sm" variant="gold" />
        </Section>

        <Section title="Inputs">
          <Input label="이메일" placeholder="you@example.com" value={text} onChangeText={setText} keyboardType="email-address" autoCapitalize="none" />
          <Input label="Error state" placeholder="비밀번호" error="이메일 또는 비밀번호가 올바르지 않습니다" secureTextEntry />
          <Input label="With hint" placeholder="이름" hint="공개 프로필에 표시됩니다" />
        </Section>

        <Section title="Badges">
          <View className="flex-row flex-wrap gap-2">
            <Badge label="Neutral" />
            <Badge label="Premium" tone="gold" />
            <Badge label="Verified" tone="success" />
            <Badge label="Overdue" tone="error" />
            <Badge label="New" tone="info" />
          </View>
        </Section>

        <Section title="Avatar & Card">
          <View className="flex-row items-center gap-3">
            <Avatar name="Hyun Seok" />
            <Avatar name="Bo Rower" size={56} />
            <Avatar size={40} />
          </View>
          <Card>
            <Text className="text-[14px] text-forest-800">정적 카드 — 테두리 + 샤프 코너</Text>
          </Card>
          <Card onPress={() => {}}>
            <Text className="text-[14px] text-forest-800">누를 수 있는 카드</Text>
          </Card>
        </Section>

        <Section title="Empty state">
          <View className="h-44 rounded-sm border border-cream-300">
            <EmptyState title="아직 없습니다" subtitle="새 항목이 여기에 표시됩니다" />
          </View>
        </Section>

        <Section title="Error state">
          <View className="h-44 rounded-sm border border-cream-300">
            <ErrorState title="문제가 발생했습니다" message="네트워크 연결을 확인해주세요" onRetry={() => {}} />
          </View>
        </Section>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <Eyebrow>{title}</Eyebrow>
      {children}
    </View>
  );
}
