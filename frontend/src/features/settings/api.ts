import { api } from '../../lib/api-client';

export async function deleteMyAccount(): Promise<void> {
  await api('/api/users/me', { method: 'DELETE' });
}
