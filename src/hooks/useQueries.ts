import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getSessions, 
  getMessages, 
  createSession, 
  deleteSession, 
  renameSession, 
  saveMessage, 
  getApiKeys, 
  saveApiKey
} from '../lib/db';
import type { ChatMessage } from '../lib/db';

export const useChatSessions = (userId?: string | null) => {
  return useQuery({
    queryKey: ['sessions', userId],
    queryFn: () => getSessions(userId!),
    enabled: !!userId,
  });
};

export const useChatMessages = (sessionId?: string | null) => {
  return useQuery({
    queryKey: ['messages', sessionId],
    queryFn: () => getMessages(sessionId!),
    enabled: !!sessionId,
  });
};

export const useApiKeys = (userId?: string | null) => {
  return useQuery({
    queryKey: ['apiKeys', userId],
    queryFn: () => getApiKeys(userId!),
    enabled: !!userId,
  });
};

export const useCreateSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, title }: { userId: string; title: string }) => createSession(userId, title),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['sessions', userId] });
    },
  });
};

export const useDeleteSession = (userId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => deleteSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', userId] });
    },
  });
};

export const useRenameSession = (userId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, title }: { sessionId: string; title: string }) => renameSession(sessionId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', userId] });
    },
  });
};

export const useSaveMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, message }: { sessionId: string; message: ChatMessage }) => saveMessage(sessionId, message),
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
};

export const useSaveApiKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, provider, key }: { userId: string; provider: 'openai' | 'google'; key: string }) => saveApiKey(userId, provider, key),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys', userId] });
    },
  });
};
