import { useMutation } from '@tanstack/react-query';
import { useLogout } from '../auth';
import * as settingsApi from './api';

// Reuses useLogout's full sign-out sequence (clear token, wipe the query
// cache, redirect to /login) on success — a deleted account should leave
// nothing behind in the client any more than a normal sign-out does.
export function useDeleteAccount() {
  const logout = useLogout();
  return useMutation({
    mutationFn: settingsApi.deleteMyAccount,
    onSuccess: () => logout(),
  });
}
