import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBrokerProfile,
  getBrokerFeed,
  respondToRequest,
  ApiError,
} from "@/api/client";
import { useAuth } from "@/auth/AuthContext";

/** The broker's own profile (404 → not onboarded; caller routes to the web). */
export function useBrokerProfile() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["brokerProfile"],
    enabled: !!token,
    queryFn: () => getBrokerProfile(token as string),
    retry: (n, e) => !(e instanceof ApiError && (e.status === 404 || e.status === 403)) && n < 1,
  });
}

/** The feed of OPEN requests + broker enrichment (verified brokers only). */
export function useBrokerFeed(opts: { province?: string; mortgageCategory?: string; page?: number }) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["brokerFeed", opts],
    enabled: !!token,
    queryFn: () => getBrokerFeed(token as string, opts),
  });
}

/** Respond to a request (create a conversation); refreshes feed + credits + list. */
export function useRespond() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { requestId: string; message?: string }) =>
      respondToRequest(token as string, v.requestId, v.message),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["brokerFeed"] });
      void qc.invalidateQueries({ queryKey: ["conversations"] });
      void qc.invalidateQueries({ queryKey: ["brokerProfile"] });
    },
  });
}
