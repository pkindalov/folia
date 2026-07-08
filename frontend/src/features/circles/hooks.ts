import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as circlesApi from './api';
import type { CircleFormInput } from './schemas';

export function useCircles(page: number) {
  return useQuery({
    queryKey: ['circles', 'list', { page }],
    queryFn: () => circlesApi.listCircles(page),
  });
}

// For pickers (e.g. the editor's "share with circle" dropdown) that need to
// list every circle rather than one fixed-size page at a time — pages are
// fetched on demand via fetchNextPage and accumulated, instead of the caller
// juggling a page number that a dropdown has no natural UI for.
export function useCirclesInfinite() {
  return useInfiniteQuery({
    queryKey: ['circles', 'list', 'infinite'],
    queryFn: ({ pageParam }) => circlesApi.listCircles(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.limit);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
  });
}

export function useCircle(id: string | undefined) {
  return useQuery({
    queryKey: ['circles', id],
    queryFn: () => circlesApi.getCircle(id!),
    enabled: id !== undefined,
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
    onSuccess: (_data, id) => {
      // Evict the deleted circle's own cache entry rather than just
      // invalidating it — a background refetch of a 404'd query keeps
      // showing its last-known (pre-deletion) data, so anything that reads
      // this circle by id elsewhere (e.g. the editor's "share with circle"
      // picker) would keep rendering the deleted circle until a hard reload.
      queryClient.removeQueries({ queryKey: ['circles', id] });
      queryClient.invalidateQueries({ queryKey: ['circles'] });
      // Deleting a circle cascades to any album shared with it (reset to
      // private server-side) — refetch album data so that shows up too.
      queryClient.invalidateQueries({ queryKey: ['albums'] });
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
