import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as circlesApi from './api';
import type { CircleFormInput } from './schemas';

export function useCircles(page: number) {
  return useQuery({
    queryKey: ['circles', 'list', { page }],
    queryFn: () => circlesApi.listCircles(page),
  });
}

export function useCircle(id: string | undefined) {
  return useQuery({
    queryKey: ['circles', id],
    queryFn: () => circlesApi.getCircle(id!),
    enabled: !!id,
  });
}

export function useCreateCircle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: circlesApi.createCircle,
    onSuccess: (circle) => {
      queryClient.invalidateQueries({ queryKey: ['circles', 'list'] });
      queryClient.setQueryData(['circles', circle._id], circle);
    },
  });
}

export function useUpdateCircle(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CircleFormInput) => circlesApi.updateCircle(id, input),
    onSuccess: (circle) => {
      queryClient.setQueryData(['circles', id], circle);
      queryClient.invalidateQueries({ queryKey: ['circles', 'list'] });
    },
  });
}

export function useDeleteCircle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: circlesApi.deleteCircle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['circles'] });
    },
  });
}

export function useAddCircleMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => circlesApi.addCircleMember(id, userId),
    onSuccess: (circle) => {
      queryClient.setQueryData(['circles', id], circle);
      queryClient.invalidateQueries({ queryKey: ['circles', 'list'] });
    },
  });
}

export function useRemoveCircleMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => circlesApi.removeCircleMember(id, userId),
    onSuccess: (circle) => {
      queryClient.setQueryData(['circles', id], circle);
      queryClient.invalidateQueries({ queryKey: ['circles', 'list'] });
    },
  });
}

export function useSearchUsers(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['users', 'search', trimmed],
    queryFn: () => circlesApi.searchUsers(trimmed),
    enabled: trimmed.length >= 2,
  });
}

export function useMyInvites(page: number) {
  return useQuery({
    queryKey: ['circles', 'invites', { page }],
    queryFn: () => circlesApi.listMyInvites(page),
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ circleId, userId }: { circleId: string; userId: string }) =>
      circlesApi.acceptCircleInvite(circleId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['circles'] });
    },
  });
}

// Declining an invite and leaving a circle are the same operation from the
// server's point of view (self-removal) — reuse removeCircleMember.
export function useDeclineInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ circleId, userId }: { circleId: string; userId: string }) =>
      circlesApi.removeCircleMember(circleId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['circles'] });
    },
  });
}
