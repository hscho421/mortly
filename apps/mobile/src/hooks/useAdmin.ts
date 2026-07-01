import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminQueue,
  getAdminUsers,
  getAdminUser,
  sendAdminNotice,
  getAdminRequests,
  getAdminRequest,
  moderateAdminRequest,
  deleteAdminRequest,
  getAdminReports,
  getAdminReport,
  getAdminReportSummary,
  moderateAdminReport,
  getAdminConversations,
  getAdminConversation,
  closeAdminConversation,
  getAdminStats,
  moderateRequest,
  moderateBroker,
  moderateReport,
  moderateUser,
} from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { adminErrorMessage } from "@/lib/adminError";

type ListOpts = { search?: string; status?: string; page?: number };

/** The unified moderation queue (pending requests + broker verifications + open reports). */
export function useAdminQueue() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["adminQueue"],
    enabled: !!token,
    queryFn: () => getAdminQueue(token as string),
    staleTime: 15_000,
  });
}

/** Paginated user directory (infinite scroll). */
export function useAdminUsers(opts: { search?: string; role?: string; status?: string }) {
  const { token } = useAuth();
  return useInfiniteQuery({
    queryKey: ["adminUsers", opts],
    enabled: !!token,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getAdminUsers(token as string, { ...opts, page: pageParam }),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
  });
}

/** The three queue moderation actions; refresh the queue + surface errors. */
export function useModerateQueue() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const onSuccess = () => void qc.invalidateQueries({ queryKey: ["adminQueue"] });
  const onError = (err: unknown) => Alert.alert(t("common.error", "오류"), adminErrorMessage(err, t));
  return {
    request: useMutation({
      mutationFn: (v: { id: string; status: string; reason?: string }) =>
        moderateRequest(token as string, v.id, v.status, v.reason),
      onSuccess,
      onError,
    }),
    broker: useMutation({
      mutationFn: (v: { id: string; verificationStatus: string; reason?: string }) =>
        moderateBroker(token as string, v.id, v.verificationStatus, v.reason),
      onSuccess,
      onError,
    }),
    report: useMutation({
      mutationFn: (v: { id: string; status: string; adminNotes?: string }) =>
        moderateReport(token as string, v.id, v.status, v.adminNotes),
      onSuccess,
      onError,
    }),
  };
}

/** Suspend / ban / reactivate a user; refresh the list + surface errors. */
export function useModerateUser() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: string; reason?: string }) =>
      moderateUser(token as string, v.id, v.status, v.reason),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["adminUsers"] }),
    onError: (err) => Alert.alert(t("common.error", "오류"), adminErrorMessage(err, t)),
  });
}

// ── User detail ──────────────────────────────────────────────────────────────
export function useAdminUser(id: string | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["adminUser", id],
    enabled: !!token && !!id,
    queryFn: () => getAdminUser(token as string, id as string),
  });
}

/** User-detail actions: user status + broker verification + send notice. */
export function useUserDetailActions(userId: string | undefined, brokerId: string | undefined) {
  const { token } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const onError = (err: unknown) => Alert.alert(t("common.error", "오류"), adminErrorMessage(err, t));
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["adminUser", userId] });
    void qc.invalidateQueries({ queryKey: ["adminUsers"] });
    void qc.invalidateQueries({ queryKey: ["adminQueue"] });
  };
  return {
    setStatus: useMutation({
      mutationFn: (v: { status: string; reason?: string }) =>
        moderateUser(token as string, userId as string, v.status, v.reason),
      onSuccess: invalidate,
      onError,
    }),
    setVerification: useMutation({
      mutationFn: (v: { verificationStatus: string; reason?: string }) =>
        moderateBroker(token as string, brokerId as string, v.verificationStatus, v.reason),
      onSuccess: invalidate,
      onError,
    }),
    sendNotice: useMutation({
      mutationFn: (v: { subject: string; body: string }) =>
        sendAdminNotice(token as string, userId as string, v.subject, v.body),
      onError,
    }),
  };
}

// ── Requests moderation ──────────────────────────────────────────────────────
export function useAdminRequests(opts: ListOpts & { type?: string }) {
  const { token } = useAuth();
  return useInfiniteQuery({
    queryKey: ["adminRequests", opts],
    enabled: !!token,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getAdminRequests(token as string, { ...opts, page: pageParam }),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
  });
}
export function useAdminRequest(id: string | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["adminRequest", id],
    enabled: !!token && !!id,
    queryFn: () => getAdminRequest(token as string, id as string),
  });
}
export function useModerateRequest() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const onError = (err: unknown) => Alert.alert(t("common.error", "오류"), adminErrorMessage(err, t));
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["adminRequests"] });
    void qc.invalidateQueries({ queryKey: ["adminRequest"] });
    void qc.invalidateQueries({ queryKey: ["adminQueue"] });
  };
  return {
    setStatus: useMutation({
      mutationFn: (v: { id: string; status: string; reason?: string }) =>
        moderateAdminRequest(token as string, v.id, v.status, v.reason),
      onSuccess: invalidate,
      onError,
    }),
    remove: useMutation({
      mutationFn: (v: { id: string; reason?: string }) => deleteAdminRequest(token as string, v.id, v.reason),
      onSuccess: invalidate,
      onError,
    }),
  };
}

// ── Reports ──────────────────────────────────────────────────────────────────
export function useAdminReports(opts: { search?: string; status?: string; targetType?: string }) {
  const { token } = useAuth();
  return useInfiniteQuery({
    queryKey: ["adminReports", opts],
    enabled: !!token,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getAdminReports(token as string, { ...opts, page: pageParam }),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
  });
}
export function useAdminReportSummary() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["adminReportSummary"],
    enabled: !!token,
    queryFn: () => getAdminReportSummary(token as string),
    staleTime: 30_000,
  });
}
export function useAdminReport(id: string | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["adminReport", id],
    enabled: !!token && !!id,
    queryFn: () => getAdminReport(token as string, id as string),
  });
}
export function useModerateReport() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status?: string; adminNotes?: string }) =>
      moderateAdminReport(token as string, v.id, { status: v.status, adminNotes: v.adminNotes }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["adminReports"] });
      void qc.invalidateQueries({ queryKey: ["adminReport"] });
      void qc.invalidateQueries({ queryKey: ["adminReportSummary"] });
      void qc.invalidateQueries({ queryKey: ["adminQueue"] });
    },
    onError: (err) => Alert.alert(t("common.error", "오류"), adminErrorMessage(err, t)),
  });
}

// ── Conversations (chat history) ─────────────────────────────────────────────
export function useAdminConversations(opts: ListOpts) {
  const { token } = useAuth();
  return useInfiniteQuery({
    queryKey: ["adminConversations", opts],
    enabled: !!token,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getAdminConversations(token as string, { ...opts, page: pageParam }),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
  });
}
export function useAdminConversation(id: string | null) {
  const { token } = useAuth();
  return useInfiniteQuery({
    queryKey: ["adminConversation", id],
    enabled: !!token && !!id,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getAdminConversation(token as string, id as string, pageParam),
    // Each page is a batch of 50; nextCursor points at OLDER history.
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor ?? undefined : undefined),
  });
}
export function useCloseAdminConversation() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; reason?: string }) => closeAdminConversation(token as string, v.id, v.reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["adminConversation"] });
      void qc.invalidateQueries({ queryKey: ["adminConversations"] });
    },
    onError: (err) => Alert.alert(t("common.error", "오류"), adminErrorMessage(err, t)),
  });
}

// ── Stats ────────────────────────────────────────────────────────────────────
export function useAdminStats() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["adminStats"],
    enabled: !!token,
    queryFn: () => getAdminStats(token as string),
    staleTime: 30_000,
  });
}
