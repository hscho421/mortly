import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminQueue,
  getAdminUsers,
  moderateRequest,
  moderateBroker,
  moderateReport,
  moderateUser,
} from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { adminErrorMessage } from "@/lib/adminError";

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
