import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as profileApi from './api';

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
  });
}

export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: profileApi.removeAvatar,
    onSuccess: (user) => {
      queryClient.setQueryData(['me'], user);
    },
  });
}
