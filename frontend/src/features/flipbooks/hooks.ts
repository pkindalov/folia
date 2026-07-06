import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as albumsApi from './api';
import type { AlbumFormInput } from './schemas';

export function useAlbums() {
  return useQuery({ queryKey: ['albums'], queryFn: albumsApi.listAlbums });
}

export function useAlbum(id: string | undefined) {
  return useQuery({
    queryKey: ['albums', id],
    queryFn: () => albumsApi.getAlbum(id!),
    enabled: !!id,
  });
}

export function useCreateAlbum() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: albumsApi.createAlbum,
    onSuccess: (album) => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      queryClient.setQueryData(['albums', album._id], album);
      // Stay in the editor so the newly-unlocked Pages panel is reachable
      // without a second navigation.
      navigate(`/editor/${album._id}`, { replace: true });
    },
  });
}

export function useUpdateAlbum(id: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (input: AlbumFormInput) => albumsApi.updateAlbum(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      navigate('/flipbooks');
    },
  });
}

export function useDeleteAlbum() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: albumsApi.deleteAlbum,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      navigate('/flipbooks');
    },
  });
}

export function usePages(albumId: string | undefined) {
  return useQuery({
    queryKey: ['albums', albumId, 'pages'],
    queryFn: () => albumsApi.listPages(albumId!),
    enabled: !!albumId,
  });
}

export function useUploadPages(albumId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => albumsApi.uploadPages(albumId, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums', albumId, 'pages'] });
      queryClient.invalidateQueries({ queryKey: ['albums', albumId] });
      queryClient.invalidateQueries({ queryKey: ['albums'] });
    },
  });
}

export function useDeletePage(albumId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pageId: string) => albumsApi.deletePage(albumId, pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums', albumId, 'pages'] });
      queryClient.invalidateQueries({ queryKey: ['albums', albumId] });
      queryClient.invalidateQueries({ queryKey: ['albums'] });
    },
  });
}

export function useUpdatePageCaption(albumId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, caption }: { pageId: string; caption: string }) =>
      albumsApi.updatePageCaption(albumId, pageId, caption),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums', albumId, 'pages'] });
    },
  });
}

/** Stable "book cloth" color derived from the album id. */
const COVER_COLORS = ['#4A3B32', '#5B6650', '#37414F', '#1F2933', '#6E3B2C', '#5a2331', '#2C4A5A'];
export function coverColor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return COVER_COLORS[hash % COVER_COLORS.length];
}
