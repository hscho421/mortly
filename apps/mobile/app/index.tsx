import { View, ActivityIndicator } from "react-native";

/**
 * Splash / launch route. Shown briefly while the root navigator resolves the
 * stored session and redirects to the auth stack or the role home.
 */
export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-forest-800">
      <ActivityIndicator color="#c49a3a" size="large" />
    </View>
  );
}
