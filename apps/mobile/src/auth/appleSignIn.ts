import { Platform } from "react-native";

/**
 * Native "Sign in with Apple".
 *
 * expo-apple-authentication is a NATIVE module — not in Expo Go. We `import()`
 * it lazily so the JS bundle still loads in Expo Go; the import only runs when
 * the user taps the button, and throws APPLE_UNAVAILABLE there. It succeeds in a
 * development/production build on iOS.
 *
 * Returns the `identityToken` to POST to /api/auth/mobile-oauth (the server
 * verifies it), plus the full name Apple only returns on first authorization.
 */
export async function signInWithApple(): Promise<{
  identityToken: string;
  fullName: string | null;
}> {
  if (Platform.OS !== "ios") throw new Error("APPLE_IOS_ONLY");

  let AppleAuthentication: typeof import("expo-apple-authentication");
  try {
    AppleAuthentication = await import("expo-apple-authentication");
  } catch {
    throw new Error("APPLE_UNAVAILABLE");
  }

  const available = await AppleAuthentication.isAvailableAsync().catch(() => false);
  if (!available) throw new Error("APPLE_UNAVAILABLE");

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) throw new Error("APPLE_NO_TOKEN");

  const fullName = credential.fullName
    ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(" ") || null
    : null;

  return { identityToken: credential.identityToken, fullName };
}
