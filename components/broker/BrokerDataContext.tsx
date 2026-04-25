import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

/**
 * BrokerDataContext — single polling loop shared across `/broker/*` pages.
 *
 * Responsibilities:
 *   • Fetch broker profile once, cache, and expose it to every page.
 *   • Fetch lightweight counters (new-request count, unread messages) on a
 *     slow cadence so sidebar badges stay fresh without every page starting
 *     its own fetch loop.
 *   • Detect "no broker profile yet" → redirect to /broker/onboarding.
 *   • Detect missing session / wrong role → redirect to /login.
 *
 * Mounted above the page component in `_app.tsx` via `<BrokerScope>`, so any
 * broker page can call `useBrokerData()` directly.
 */

export interface BrokerProfile {
  id: string;
  userId: string;
  brokerageName: string;
  province: string;
  licenseNumber: string | null;
  phone: string | null;
  bio: string | null;
  yearsExperience: number | null;
  specialties: string | null;
  areasServed: string | null;
  profilePhoto: string | null;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED" | string;
  subscriptionTier: "FREE" | "BASIC" | "PRO" | "PREMIUM" | string;
  responseCredits: number;
  mortgageCategory: "RESIDENTIAL" | "COMMERCIAL" | "BOTH" | string;
  user: { id: string; name: string | null; email: string };
}

export interface BrokerCounters {
  /** OPEN requests the broker hasn't seen. */
  newRequests: number;
  /** Unread messages across all conversations. */
  unreadMessages: number;
  /** Active (non-closed) conversations. */
  activeConversations: number;
}

/**
 * Lightweight conversation shape exposed to consumers (sidebar badge counts,
 * dashboard recent-activity widget). Pages that need the full Message[] array
 * still call `/api/conversations/[id]` directly — that data isn't cached here
 * because it's per-conversation and frequently updated via Realtime.
 */
export interface BrokerCachedConversation {
  id: string;
  publicId?: string;
  status: string;
  updatedAt: string;
  unreadCount?: number;
  messages: { body: string; createdAt: string; senderId: string }[];
  broker?: {
    id?: string;
    brokerageName?: string;
    user?: { id?: string; name?: string | null };
  };
  borrower: { id: string; name: string | null };
  request: {
    id: string;
    publicId?: string | null;
    province: string;
    city?: string | null;
    status?: string | null;
    mortgageCategory?: string | null;
    productTypes?: string[] | null;
  };
}

export interface BrokerCachedRequest {
  id: string;
  publicId: string;
  province: string;
  city?: string | null;
  status: string;
  createdAt: string;
  mortgageCategory?: string | null;
  productTypes?: string[] | null;
  desiredTimeline?: string | null;
  isNew?: boolean;
  conversations?: { broker?: { userId: string } }[];
  _count?: { conversations?: number };
}

interface BrokerDataContextValue {
  profile: BrokerProfile | null;
  counters: BrokerCounters;
  /** Recent open requests for sidebar+dashboard widgets. Up to 5. */
  recentRequests: BrokerCachedRequest[];
  /** All conversations (no pagination — list is small per broker). */
  conversations: BrokerCachedConversation[];
  loaded: boolean;
  /** True once profile resolved (even if null/404). */
  profileChecked: boolean;
  refresh: () => Promise<void>;
}

const DEFAULT_COUNTERS: BrokerCounters = {
  newRequests: 0,
  unreadMessages: 0,
  activeConversations: 0,
};

const BrokerDataContext = createContext<BrokerDataContextValue>({
  profile: null,
  counters: DEFAULT_COUNTERS,
  recentRequests: [],
  conversations: [],
  loaded: false,
  profileChecked: false,
  refresh: async () => {},
});

export function useBrokerData() {
  return useContext(BrokerDataContext);
}

const POLL_INTERVAL_MS = 30_000;

export function BrokerDataProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<BrokerProfile | null>(null);
  const [counters, setCounters] = useState<BrokerCounters>(DEFAULT_COUNTERS);
  const [recentRequests, setRecentRequests] = useState<BrokerCachedRequest[]>([]);
  const [conversations, setConversations] = useState<BrokerCachedConversation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const redirectedRef = useRef(false);

  const onboardingPath = "/broker/onboarding";

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/brokers/profile");
      if (res.status === 404) {
        setProfile(null);
        setProfileChecked(true);
        // Redirect to onboarding unless already there (avoid tight loop).
        if (!redirectedRef.current && router.pathname !== onboardingPath) {
          redirectedRef.current = true;
          router.replace(onboardingPath, undefined, { locale: router.locale });
        }
        return;
      }
      if (!res.ok) {
        setProfileChecked(true);
        return;
      }
      const data = (await res.json()) as BrokerProfile;
      setProfile(data);
      setProfileChecked(true);
    } catch {
      // Network errors leave previous profile intact; poller will retry.
      setProfileChecked(true);
    }
  }, [router]);

  const fetchCounters = useCallback(async () => {
    try {
      // Bumped to limit=5 (was limit=1) so this single fetch serves both the
      // sidebar badge AND the dashboard's "new requests" widget. The cost
      // delta vs limit=1 is negligible and it deduplicates the dashboard's
      // previously-separate /api/requests call.
      const [reqRes, unreadRes, convosRes] = await Promise.all([
        fetch("/api/requests?limit=5"),
        fetch("/api/messages/unread"),
        fetch("/api/conversations"),
      ]);
      const nextCounters: BrokerCounters = { ...DEFAULT_COUNTERS };
      if (reqRes.ok) {
        const json = await reqRes.json();
        nextCounters.newRequests =
          typeof json.newCount === "number" ? json.newCount : 0;
        const data = (json.data ?? []) as BrokerCachedRequest[];
        setRecentRequests(data);
      }
      if (unreadRes.ok) {
        const json = await unreadRes.json();
        nextCounters.unreadMessages =
          typeof json.unread === "number" ? json.unread : 0;
      }
      if (convosRes.ok) {
        const json = await convosRes.json();
        if (Array.isArray(json)) {
          const list = json as BrokerCachedConversation[];
          nextCounters.activeConversations = list.filter(
            (c) => c.status === "ACTIVE",
          ).length;
          setConversations(list);
        }
      }
      setCounters(nextCounters);
    } catch {
      // keep previous counters / lists
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchProfile(), fetchCounters()]);
  }, [fetchProfile, fetchCounters]);

  // Initial + polling loop. Only runs when we have a verified broker session.
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "BROKER") {
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

  const value = useMemo<BrokerDataContextValue>(
    () => ({
      profile,
      counters,
      recentRequests,
      conversations,
      loaded,
      profileChecked,
      refresh,
    }),
    [profile, counters, recentRequests, conversations, loaded, profileChecked, refresh],
  );

  return (
    <BrokerDataContext.Provider value={value}>
      {children}
    </BrokerDataContext.Provider>
  );
}
