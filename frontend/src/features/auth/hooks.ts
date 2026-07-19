import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { tokenStorage, ApiError } from '../../lib/api-client';
import * as authApi from './api';

export function useMe() {
  const token = tokenStorage.get();
  return useQuery({
    queryKey: ['me'],
    queryFn: authApi.fetchMe,
    enabled: token !== null && token !== '',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 401 ? false : failureCount < 2,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      queryClient.setQueryData(['me'], data.user);
      navigate('/');
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      queryClient.setQueryData(['me'], data.user);
      navigate('/');
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return () => {
    // Fire-and-forget: the server-side invalidation happens in the
    // background — signing out locally shouldn't wait on a network round trip.
    void authApi.logout();
    queryClient.clear();
    navigate('/login');
  };
}

export function isAuthenticated(): boolean {
  const token = tokenStorage.get();
  return token !== null && token !== '';
}
