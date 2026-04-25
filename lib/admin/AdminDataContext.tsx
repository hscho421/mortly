import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fetchInboxQueue, type InboxRow } from "./inboxQueue";

/**
 * Shared admin state — single polling loop that owns:
 *   - rail badge counts (pendingVerifications, pendingRequests, openReports)
 *   - inbox queue rows (merged PENDING requests + PENDING brokers + OPEN reports)
 *
 * Before this: AdminShell and Inbox each polled independently, doubling DB load
 * and leaving rail counts stale for up to 60s after a mutation. Now any page
 * can call `invalidate()` after a mutation to refetch once and update both.
 */

export interface AdminBadgeCounts {
  pendingVerifications: number;
  pendingRequests: number;
  openReports: number;
  /** derived sum; the red inbox dot uses this */
  inbox: number;
}

interface AdminDataState {
  badges: AdminBadgeCounts;
  inboxRows: InboxRow[];
  badgesLoaded: boolean;
  inboxLoaded: boolean;
  error: string | null;
  /** force a refetch of both streams. Returns when done. */
  invalidate: () => Promise<void>;
}

const DEFAULT_BADGES: AdminBadgeCounts = {
  pendingVerifications: 0,
  pendingRequests: 0,
  openReports: 0,
  inbox: 0,
};

const AdminDataContext = createContext<AdminDataState>({
  badges: DEFAULT_BADGES,
  inboxRows: [],
  badgesLoaded: false,
  inboxLoaded: false,
  error: null,
  invalidate: async () => {},
});

const POLL_MS = 60_000;

interface StatsShape {
  pendingVerifications?: number;
  openReports?: number;
  requestsByStatus?: { pendingApproval?: number };
}

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [badges, setBadges] = useState<AdminBadgeCounts>(DEFAULT_BADGES);
  const [inboxRows, setInboxRows] = useState<InboxRow[]>([]);
  const [badgesLoaded, setBadgesLoaded] = useState(false);
  const [inboxLoaded, setInboxLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refetchStats = useCallback(async () => {
    const res = await fetch("/api/admin/stats");
    if (!res.ok) return;
    const data = (await res.json()) as StatsShape;
    const pendingRequests =
      typeof data.requestsByStatus?.pendingApproval === "number"
        ? data.requestsByStatus.pendingApproval
        : 0;
    const pendingVerifications = data.pendingVerifications ?? 0;
    const openReports = data.openReports ?? 0;
    setBadges({
      pendingVerifications,
      pendingRequests,
      openReports,
      inbox: pendingVerifications + pendingRequests + openReports,
    });
    setBadgesLoaded(true);
  }, []);

  const refetchInbox = useCallback(async () => {
    try {
      const rows = await fetchInboxQueue();
      setInboxRows(rows);
      setError(null);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[AdminDataContext] inbox fetch failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setInboxLoaded(true);
    }
  }, []);

  const refetchAll = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await Promise.all([refetchStats(), refetchInbox()]);
    } finally {
      inFlight.current = false;
    }
  }, [refetchStats, refetchInbox]);

  // Initial fetch + 60s poll
  useEffect(() => {
    refetchAll();
    const id = setInterval(refetchAll, POLL_MS);
    // Visibility-aware: pause polling when tab is hidden to reduce load
    const onVisibility = () => {
      if (document.visibilityState === "visible") refetchAll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refetchAll]);

  const value = useMemo<AdminDataState>(
    () => ({
      badges,
      inboxRows,
      badgesLoaded,
      inboxLoaded,
      error,
      invalidate: refetchAll,
    }),
    [badges, inboxRows, badgesLoaded, inboxLoaded, error, refetchAll],
  );

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData() {
  return useContext(AdminDataContext);
}
