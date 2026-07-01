import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyRequests, getRequest, createRequest, type CreateRequestInput } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";

/** The signed-in borrower's requests (GET /api/requests). */
export function useMyRequests() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["requests"],
    enabled: !!token,
    queryFn: async () => (await getMyRequests(token as string)).data,
  });
}

/** One request with its embedded broker responses (GET /api/requests/:id). */
export function useRequest(id: string | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["request", id],
    enabled: !!token && !!id,
    queryFn: () => getRequest(token as string, id as string),
  });
}

/** Create a request (POST /api/requests); refreshes the list on success. */
export function useCreateRequest() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRequestInput) => createRequest(token as string, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}
