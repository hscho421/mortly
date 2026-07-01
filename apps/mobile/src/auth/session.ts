import * as SecureStore from "expo-secure-store";

/**
 * Session persistence. The minted next-auth JWT + the safe user object live in
 * the device Keychain/Keystore (expo-secure-store), never in plain storage.
 */

export interface SessionUser {
  id: string;
  publicId: string;
  email: string;
  name: string | null;
  role: "BORROWER" | "BROKER" | "ADMIN";
  needsRoleSelection: boolean;
  needsNameEntry: boolean;
}

export interface Session {
  token: string;
  user: SessionUser;
}

const TOKEN_KEY = "mortly.session.token";
const USER_KEY = "mortly.session.user";

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, session.token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(session.user));
}

export async function loadSession(): Promise<Session | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const rawUser = await SecureStore.getItemAsync(USER_KEY);
  if (!token || !rawUser) return null;
  try {
    return { token, user: JSON.parse(rawUser) as SessionUser };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}
