import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSession } from "next-auth/react";

/**
 * BorrowerDataContext — single polling loop shared across `/borrower/*` pages.
 *
 * Mirrors BrokerDataContext but for the borrower. Owns:
 *   • Borrower profile (name, email, request/conversation counts).
 *   • Lightweight counters (active requests, unread messages) for sidebar
 *     badges and dashboard headlines.
 *
 * Mounted above page components in `_app.tsx` via `<BorrowerScope>`. Pages
 * read from `useBorrowerData()` instead of re-fetching themselves.
 */

export interface BorrowerProfile {
  id: string;
  publicId: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  _count: {
    borrowerRequests: number;
    conversations: number;
    reviews?: number;
  };
}

export interface BorrowerCounters {
  /** OPEN or IN_PROGRESS requests. */
  activeRequests: number;
  /** Unread messages across all conversations. */
  unreadMessages: number;
  /** ACTIVE conversations. */
  activeConversations: number;
  /** Total broker responses (i.e. conversations) across all requests. */
  totalResponses: number;
}

interface BorrowerDataContextValue {
  profile: BorrowerProfile | null;
  counters: BorrowerCounters;
  loaded: boolean;
  profileChecked: boolean;
  refresh: () => Promise<void>;
}

const DEFAULT_COUNTERS: BorrowerCounters = {
  activeRequests: 0,
  unreadMessages: 0,
  activeConversations: 0,
  totalResponses: 0,
};

const BorrowerDataContext = createContext<BorrowerDataContextValue>({
  profile: null,
  counters: DEFAULT_COUNTERS,
  loaded: false,
  profileChecked: false,
  refresh: async () => {},
});

export function useBorrowerData() {
  return useContext(BorrowerDataContext);
}

const POLL_INTERVAL_MS = 30_000;

export function BorrowerDataProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<BorrowerProfile | null>(null);
  const [counters, setCounters] = useState<BorrowerCounters>(DEFAULT_COUNTERS);
  const [loaded, setLoaded] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/borrowers/profile");
      if (!res.ok) {
        setProfileChecked(true);
        return;
      }
      const data = (await res.json()) as BorrowerProfile;
      setProfile(data);
      setProfileChecked(true);
    } catch {
      setProfileChecked(true);
    }
  }, []);

  const fetchCounters = useCallback(async () => {
    try {
      const [reqRes, unreadRes, convRes] = await Promise.all([
        fetch("/api/requests"),
        fetch("/api/messages/unread"),
        fetch("/api/conversations"),
      ]);
      const next: BorrowerCounters = { ...DEFAULT_COUNTERS };
      if (reqRes.ok) {
        const json = await reqRes.json();
        const list = (json.data ?? json) as Array<{
          status: string;
          _count?: { conversations?: number };
          conversations?: unknown[];
        }>;
        next.activeRequests = list.filter(
          (r) => r.status === "OPEN" || r.status === "IN_PROGRESS",
        ).length;
        next.totalResponses = list.reduce(
          (sum, r) =>
            sum +
            (r._count?.conversations ?? r.conversations?.length ?? 0),
          0,
        );
      }
      if (unreadRes.ok) {
        const json = await unreadRes.json();
        next.unreadMessages =
          typeof json.unread === "number" ? json.unread : 0;
      }
      if (convRes.ok) {
        const list = (await convRes.json()) as Array<{ status: string }>;
        next.activeConversations = list.filter(
          (c) => c.status === "ACTIVE",
        ).length;
      }
      setCounters(next);
    } catch {
      // keep previous counters
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchProfile(), fetchCounters()]);
  }, [fetchProfile, fetchCounters]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "BORROWER") {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      await fetchProfile();
      await fetchCounters();
      if (!cancelled) setLoaded(true);
    })();

    const iv = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchCounters();
    }, POLL_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchCounters();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [session, status, fetchProfile, fetchCounters]);

  const value = useMemo<BorrowerDataContextValue>(
    () => ({ profile, counters, loaded, profileChecked, refresh }),
    [profile, counters, loaded, profileChecked, refresh],
  );

  return (
    <BorrowerDataContext.Provider value={value}>
      {children}
    </BorrowerDataContext.Provider>
  );
}
