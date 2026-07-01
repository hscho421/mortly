import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { clearSession, loadSession, saveSession, type Session, type SessionUser } from "@/auth/session";
import { loginWithOAuth, loginWithPassword } from "@/api/client";
import { unregisterForPush } from "@/notifications/push";

type Status = "loading" | "authed" | "guest";

interface AuthState {
  status: Status;
  user: SessionUser | null;
  token: string | null;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signInWithOAuth: (provider: "google" | "apple", idToken: string, name?: string | null) => Promise<void>;
  /** Persist a refreshed token + user (e.g. after onboarding role/name changes). */
  updateSession: (token: string, user: SessionUser) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let alive = true;
    loadSession().then((s) => {
      if (!alive) return;
      setSession(s);
      setStatus(s ? "authed" : "guest");
    });
    return () => {
      alive = false;
    };
  }, []);

  const commit = useCallback(async (s: Session) => {
    await saveSession(s);
    setSession(s);
    setStatus("authed");
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const { sessionToken, user } = await loginWithPassword(email, password);
      await commit({ token: sessionToken, user });
    },
    [commit],
  );

  const signInWithOAuth = useCallback(
    async (provider: "google" | "apple", idToken: string, name?: string | null) => {
      const { sessionToken, user } = await loginWithOAuth(provider, idToken, name);
      await commit({ token: sessionToken, user });
    },
    [commit],
  );

  const updateSession = useCallback(
    async (token: string, user: SessionUser) => {
      await commit({ token, user });
    },
    [commit],
  );

  const signOut = useCallback(async () => {
    // Release this device's push token before the session token is cleared.
    if (session?.token) await unregisterForPush(session.token).catch(() => {});
    await clearSession();
    setSession(null);
    setStatus("guest");
  }, [session?.token]);

  return (
    <AuthCtx.Provider
      value={{
        status,
        user: session?.user ?? null,
        token: session?.token ?? null,
        signInWithPassword,
        signInWithOAuth,
        updateSession,
        signOut,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
