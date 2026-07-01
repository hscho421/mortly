import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getConversations,
  getConversation,
  sendMessage,
  closeConversation,
} from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { useConversationSync } from "@/realtime/useConversationSync";

/** Conversation list (GET /api/conversations). */
export function useConversations() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["conversations"],
    enabled: !!token,
    queryFn: () => getConversations(token as string),
    staleTime: 10_000,
  });
}

/**
 * One thread (GET /api/conversations/:id). Refreshes on the Supabase "sync"
 * broadcast (useConversationSync) AND polls every 5s as a fallback — exactly
 * the web's model. Loading it also marks messages read server-side.
 */
export function useConversation(id: string | null) {
  const { token } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["conversation", id],
    enabled: !!token && !!id,
    queryFn: () => getConversation(token as string, id as string),
    refetchInterval: 5000,
  });

  const onSync = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["conversation", id] });
  }, [qc, id]);
  useConversationSync(id, onSync);

  return query;
}

/** Send a message; refreshes the thread + list on success. */
export function useSendMessage(conversationId: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => sendMessage(token as string, conversationId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

/** Close a thread (borrower only). */
export function useCloseConversation(conversationId: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => closeConversation(token as string, conversationId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
