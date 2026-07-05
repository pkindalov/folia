import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as authApi from '../api/auth';
import { tokenStorage, ApiError } from '../api/client';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: authApi.fetchMe,
    enabled: !!tokenStorage.get(),
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
    authApi.logout();
    queryClient.clear();
    navigate('/login');
  };
}

export function isAuthenticated(): boolean {
  return !!tokenStorage.get();
}
