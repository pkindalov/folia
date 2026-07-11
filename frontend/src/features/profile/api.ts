import { api } from '../../lib/api-client';
import { meResponseSchema, type User } from '../auth';
import { publicProfileResponseSchema, type PublicUser, type UpdateProfileInput } from './schemas';

export async function updateProfile(input: UpdateProfileInput): Promise<User> {
  const data = await api('/api/users/me', { method: 'PUT', body: JSON.stringify(input) });
  return meResponseSchema.parse(data).user;
}

export async function getPublicProfile(username: string): Promise<PublicUser> {
  const data = await api(`/api/users/${encodeURIComponent(username)}`);
  return publicProfileResponseSchema.parse(data).user;
}

export async function uploadAvatar(file: File): Promise<User> {
  const formData = new FormData();
  formData.append('avatar', file);
  const data = await api('/api/users/me/avatar', { method: 'POST', body: formData });
  return meResponseSchema.parse(data).user;
}

export async function removeAvatar(): Promise<User> {
  const data = await api('/api/users/me/avatar', { method: 'DELETE' });
  return meResponseSchema.parse(data).user;
}
