import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as albumsApi from './api';
import type { Album, AlbumFormInput, ReactionType } from './schemas';

export function useAlbums(page: number, visibility?: Album['visibility']) {
  return useQuery({
    queryKey: ['albums', 'list', { page, visibility }],
    queryFn: () => albumsApi.listAlbums(page, visibility),
    placeholderData: keepPreviousData,
  });
}

export function usePublicAlbums(page: number) {
  return useQuery({
    queryKey: ['albums', 'public', page],
    queryFn: () => albumsApi.listPublicAlbums(page),
    placeholderData: keepPreviousData,
  });
}

export function useArchivedAlbums(page: number) {
  return useQuery({
    queryKey: ['albums', 'archived', page],
    queryFn: () => albumsApi.listArchivedAlbums(page),
    placeholderData: keepPreviousData,
  });
}

export function useSharedWithMeAlbums(page: number) {
  return useQuery({
    queryKey: ['albums', 'shared-with-me', page],
    queryFn: () => albumsApi.listSharedWithMeAlbums(page),
    placeholderData: keepPreviousData,
  });
}

export function useAlbum(id: string | undefined) {
  return useQuery({
    queryKey: ['albums', id],
    queryFn: () => albumsApi.getAlbum(id!),
    enabled: id !== undefined,
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
    onSuccess: (_data, id) => {
      // Evict the deleted album's own cache entry rather than just
      // invalidating it — a background refetch of a 404'd query keeps
      // showing its last-known (pre-deletion) data, so navigating back to
      // /editor/:id or /book/:id for this album would keep rendering the
      // deleted album until a hard reload.
      queryClient.removeQueries({ queryKey: ['albums', id] });
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      navigate('/flipbooks');
    },
  });
}

export function usePages(albumId: string | undefined) {
  return useQuery({
    queryKey: ['albums', albumId, 'pages'],
    queryFn: () => albumsApi.listPages(albumId!),
    enabled: albumId !== undefined,
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

export function useSetCoverPhoto(albumId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pageId: string) => albumsApi.setCoverPhoto(albumId, pageId),
    onSuccess: (album) => {
      queryClient.setQueryData(['albums', albumId], album);
      queryClient.invalidateQueries({ queryKey: ['albums'] });
    },
  });
}

export function useSetPageReaction(albumId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, type }: { pageId: string; type: ReactionType }) =>
      albumsApi.setPageReaction(albumId, pageId, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums', albumId, 'pages'] });
    },
  });
}

export function useArchiveAlbum(albumId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (archived: boolean) => albumsApi.archiveAlbum(albumId, archived),
    onSuccess: (album) => {
      queryClient.setQueryData(['albums', albumId], album);
      queryClient.invalidateQueries({ queryKey: ['albums'] });
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
