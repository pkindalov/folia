import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../lib/api-client';
import * as profileApi from './api';

// A 409 means another request (another tab/device) already changed the
// avatar first — our cached ['me'] is now stale, so refetch the real state
// instead of leaving the UI showing the pre-conflict avatar.
function refetchMeOnConflict(queryClient: ReturnType<typeof useQueryClient>, error: Error) {
  if (error instanceof ApiError && error.status === 409) {
    queryClient.invalidateQueries({ queryKey: ['me'] });
  }
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: profileApi.updateProfile,
    onSuccess: (user) => {
      queryClient.setQueryData(['me'], user);
    },
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: profileApi.uploadAvatar,
    onSuccess: (user) => {
      queryClient.setQueryData(['me'], user);
    },
    onError: (error) => refetchMeOnConflict(queryClient, error),
  });
}

export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: profileApi.removeAvatar,
    onSuccess: (user) => {
      queryClient.setQueryData(['me'], user);
    },
    onError: (error) => refetchMeOnConflict(queryClient, error),
  });
}

export function usePublicProfile(username: string | undefined) {
  return useQuery({
    queryKey: ['users', username],
    queryFn: () => profileApi.getPublicProfile(username!),
    enabled: username !== undefined,
  });
}
