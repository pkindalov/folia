import { api } from '../../lib/api-client';
import {
  circlesResponseSchema,
  circleResponseSchema,
  circleInvitesResponseSchema,
  userSearchResponseSchema,
  type Circle,
  type CircleFormInput,
  type PaginatedCircles,
  type PaginatedCircleInvites,
  type UserSearchResult,
} from './schemas';

export async function listCircles(page: number): Promise<PaginatedCircles> {
  const params = new URLSearchParams({ page: String(page) });
  const data = await api(`/api/circles?${params}`);
  return circlesResponseSchema.parse(data);
}

export async function getCircle(id: string): Promise<Circle> {
  const data = await api(`/api/circles/${id}`);
  return circleResponseSchema.parse(data).circle;
}

export async function createCircle(input: CircleFormInput): Promise<Circle> {
  const data = await api('/api/circles', { method: 'POST', body: JSON.stringify(input) });
  return circleResponseSchema.parse(data).circle;
}

export async function updateCircle(id: string, input: CircleFormInput): Promise<Circle> {
  const data = await api(`/api/circles/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  return circleResponseSchema.parse(data).circle;
}

export async function deleteCircle(id: string): Promise<void> {
  await api(`/api/circles/${id}`, { method: 'DELETE' });
}

export async function addCircleMember(id: string, userId: string): Promise<Circle> {
  const data = await api(`/api/circles/${id}/members`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
  return circleResponseSchema.parse(data).circle;
}

export async function removeCircleMember(id: string, userId: string): Promise<Circle> {
  const data = await api(`/api/circles/${id}/members/${userId}`, { method: 'DELETE' });
  return circleResponseSchema.parse(data).circle;
}

export async function listMyInvites(page: number): Promise<PaginatedCircleInvites> {
  const params = new URLSearchParams({ page: String(page) });
  const data = await api(`/api/circles/invites?${params}`);
  return circleInvitesResponseSchema.parse(data);
}

export async function acceptCircleInvite(id: string, userId: string): Promise<Circle> {
  const data = await api(`/api/circles/${id}/members/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'accepted' }),
  });
  return circleResponseSchema.parse(data).circle;
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  const data = await api(`/api/users/search?${params}`);
  return userSearchResponseSchema.parse(data).users;
}
