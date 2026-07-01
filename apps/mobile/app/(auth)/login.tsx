import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/AuthContext";
import { ApiError } from "@/api/client";
import { signInWithApple } from "@/auth/appleSignIn";

const ERROR_KO: Record<string, string> = {
  MISSING_CREDENTIALS: "이메일과 비밀번호를 입력해주세요.",
  INVALID_CREDENTIALS: "이메일 또는 비밀번호가 올바르지 않습니다.",
  GOOGLE_ACCOUNT: "소셜 로그인으로 가입된 계정입니다.",
  EMAIL_NOT_VERIFIED: "이메일 인증이 필요합니다.",
  ACCOUNT_SUSPENDED: "정지된 계정입니다.",
  ACCOUNT_BANNED: "이용이 제한된 계정입니다.",
};

export default function Login() {
  const { t } = useTranslation();
  const { signInWithPassword, signInWithOAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await signInWithPassword(email.trim(), password);
      // RootNavigator redirects to the role home on success.
    } catch (e) {
      if (e instanceof ApiError) {
        // Uses the shared i18n key when present, else a KO fallback.
        setError(t(`mobile.authError.${e.code}`, ERROR_KO[e.code] ?? "로그인에 실패했습니다."));
      } else {
        // Network / unreachable server — don't mislabel it as bad credentials.
        setError(t("mobile.connectionError", "서버에 연결할 수 없습니다. 네트워크를 확인해주세요."));
      }
      setBusy(false);
    }
  }

  async function onApple() {
    setError(null);
    try {
      const { identityToken, fullName } = await signInWithApple();
      await signInWithOAuth("apple", identityToken, fullName);
      // RootNavigator redirects on success.
    } catch (e) {
      const code = e instanceof ApiError ? e.code : e instanceof Error ? e.message : "APPLE_FAILED";
      if (code === "ERR_REQUEST_CANCELED") return; // user dismissed — stay silent
      if (code === "APPLE_UNAVAILABLE") {
        setError("Apple 로그인은 개발/배포 빌드에서만 가능합니다 (Expo Go 미지원).");
        return;
      }
      setError(t(`mobile.authError.${code}`, ERROR_KO[code] ?? "Apple 로그인에 실패했습니다."));
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-forest-800" edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <View className="flex-1 px-7">
          <View className="mt-6 flex-row items-center gap-2">
            <View className="h-[7px] w-[7px] rounded-full bg-amber-500" />
            <Text className="font-display text-[19px] font-semibold text-white">mortly</Text>
          </View>

          <View className="flex-1 justify-center gap-3">
            <Text className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400">
              Mortgage, made human
            </Text>
            <Text className="font-display text-[30px] font-light leading-[38px] text-cream-50">
              믿을 수 있는{"\n"}
              <Text className="font-semibold text-white">모기지 전문가</Text>를{"\n"}지금 만나보세요
            </Text>
          </View>

          <View className="gap-3 pb-2">
            <View className="gap-2.5">
              <TextInput
                className="h-[52px] rounded-sm border border-forest-600 bg-forest-700 px-4 text-[16px] text-white"
                placeholder={t("mobile.email", "이메일")}
                placeholderTextColor="#7681a1"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                inputMode="email"
                value={email}
                onChangeText={setEmail}
                returnKeyType="next"
              />
              <TextInput
                className="h-[52px] rounded-sm border border-forest-600 bg-forest-700 px-4 text-[16px] text-white"
                placeholder={t("mobile.password", "비밀번호")}
                placeholderTextColor="#7681a1"
                autoCapitalize="none"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                returnKeyType="go"
                onSubmitEditing={submit}
              />
            </View>

            {error ? <Text className="text-[13px] text-error-500">{error}</Text> : null}

            <Pressable
              onPress={submit}
              disabled={busy}
              accessibilityRole="button"
              className={`h-[52px] items-center justify-center rounded-sm bg-amber-500 ${busy ? "opacity-50" : ""}`}
            >
              <Text className="font-display text-[16px] font-semibold text-forest-900">
                {busy ? t("mobile.signingIn", "로그인 중…") : t("mobile.signIn", "로그인")}
              </Text>
            </Pressable>

            {Platform.OS === "ios" ? (
              <Pressable
                onPress={onApple}
                accessibilityRole="button"
                className="h-[52px] flex-row items-center justify-center rounded-sm bg-white"
              >
                <Text className="font-display text-[16px] font-semibold text-black">Apple로 계속하기</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() =>
                Alert.alert(
                  "Google",
                  "Google 로그인은 client ID 설정 + 개발 빌드가 필요합니다 (@react-native-google-signin 또는 expo-auth-session → /api/auth/mobile-oauth).",
                )
              }
              accessibilityRole="button"
              className="h-[52px] flex-row items-center justify-center rounded-sm border border-forest-600"
            >
              <Text className="font-display text-[16px] font-semibold text-white">Google로 계속하기</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
