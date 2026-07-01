import { useQuery } from "@tanstack/react-query";
import { getMe, ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";

/**
 * The current user, read fresh from the backend (GET /api/users/me). Proves the
 * authed API loop end-to-end: session token → cookie → getServerSession → user.
 *
 * If the token is no longer valid (a `tokenVersion` bump / "log out everywhere",
 * or expiry) the call 401s and we drop the local session — the app then routes
 * back to login.
 */
export function useMe() {
  const { token, signOut } = useAuth();
  return useQuery({
    queryKey: ["me"],
    enabled: !!token,
    queryFn: async () => {
      try {
        const { user } = await getMe(token as string);
        return user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await signOut();
        }
        throw err;
      }
    },
    // Don't retry an auth failure — the session is already being cleared.
    retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 1,
    staleTime: 60_000,
  });
}
