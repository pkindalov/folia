import { api } from '../../lib/api-client';
import {
  albumsResponseSchema,
  albumResponseSchema,
  pagesResponseSchema,
  uploadPagesResponseSchema,
  deletePageResponseSchema,
  type Album,
  type AlbumFormInput,
  type Page,
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

export async function listPages(albumId: string): Promise<Page[]> {
  const data = await api(`/api/albums/${albumId}/pages`);
  return pagesResponseSchema.parse(data).pages;
}

export async function uploadPages(
  albumId: string,
  files: File[]
): Promise<{ pages: Page[]; pageCount: number }> {
  const formData = new FormData();
  for (const file of files) formData.append('photos', file);
  const data = await api(`/api/albums/${albumId}/pages`, { method: 'POST', body: formData });
  return uploadPagesResponseSchema.parse(data);
}

export async function deletePage(albumId: string, pageId: string): Promise<{ pageCount: number }> {
  const data = await api(`/api/albums/${albumId}/pages/${pageId}`, { method: 'DELETE' });
  return deletePageResponseSchema.parse(data);
}
