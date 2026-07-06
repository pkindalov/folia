import { api } from '../../lib/api-client';
import {
  albumsResponseSchema,
  albumResponseSchema,
  type Album,
  type AlbumFormInput,
} from './schemas';

export async function listAlbums(): Promise<Album[]> {
  const data = await api('/api/albums');
  return albumsResponseSchema.parse(data).albums;
}

export async function getAlbum(id: string): Promise<Album> {
  const data = await api(`/api/albums/${id}`);
  return albumResponseSchema.parse(data).album;
}

export async function createAlbum(input: AlbumFormInput): Promise<Album> {
  const data = await api('/api/albums', { method: 'POST', body: JSON.stringify(input) });
  return albumResponseSchema.parse(data).album;
}

export async function updateAlbum(id: string, input: AlbumFormInput): Promise<Album> {
  const data = await api(`/api/albums/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  return albumResponseSchema.parse(data).album;
}

export async function deleteAlbum(id: string): Promise<void> {
  await api(`/api/albums/${id}`, { method: 'DELETE' });
}
