import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useSetCoverPhoto, useArchiveAlbum, useAddComment, useDeleteComment } from './hooks';
import type { Album } from './schemas';
import { createTestQueryClient } from '../../tests/test-utils';
import { tokenStorage } from '../../lib/api-client';

const CACHED_ALBUM: Album = {
  _id: 'a1',
  title: 'Summer in the Valley',
  description: '',
  visibility: 'private',
  owner: 'id1',
  pageCount: 2,
  archived: false,
  reactions: { total: 5, viewerReacted: true, reactors: ['maria', 'sam'] },
};

function respond(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  tokenStorage.set('jwt-ok');
});

describe('useSetCoverPhoto', () => {
  test("does not clobber the album's already-cached love count — the response has no reactions field", async () => {
    // setCover's real response never includes a reactions summary — this
    // mirrors that shape exactly (see pages-controller.js's setCover).
    vi.mocked(fetch).mockImplementation(() =>
      respond({ album: { ...CACHED_ALBUM, reactions: undefined, coverPage: 'p2' } })
    );
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['albums', 'a1'], CACHED_ALBUM);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSetCoverPhoto('a1'), { wrapper });
    result.current.mutate('p2');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData<Album>(['albums', 'a1'])?.reactions).toEqual({
      total: 5,
      viewerReacted: true,
      reactors: ['maria', 'sam'],
    });
  });
});

describe('useArchiveAlbum', () => {
  test("does not clobber the album's already-cached love count — the response has no reactions field", async () => {
    vi.mocked(fetch).mockImplementation(() =>
      respond({ album: { ...CACHED_ALBUM, reactions: undefined, archived: true } })
    );
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['albums', 'a1'], CACHED_ALBUM);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useArchiveAlbum('a1'), { wrapper });
    result.current.mutate(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData<Album>(['albums', 'a1'])?.reactions).toEqual({
      total: 5,
      viewerReacted: true,
      reactors: ['maria', 'sam'],
    });
  });
});

describe('useAddComment', () => {
  test('invalidates the comment thread and the page list on success', async () => {
    vi.mocked(fetch).mockImplementation(() =>
      respond({
        comment: {
          _id: 'c1',
          page: 'p1',
          user: 'u1',
          username: 'maria',
          avatarUrl: null,
          text: 'Nice!',
          createdAt: new Date().toISOString(),
        },
        commentCount: 1,
      })
    );
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useAddComment('a1'), { wrapper });
    result.current.mutate({ pageId: 'p1', text: 'Nice!' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['albums', 'a1', 'pages', 'p1', 'comments'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['albums', 'a1', 'pages'] });
  });
});

describe('useDeleteComment', () => {
  test('invalidates the comment thread and the page list on success', async () => {
    vi.mocked(fetch).mockImplementation(() => respond({ deleted: true, commentCount: 0 }));
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDeleteComment('a1'), { wrapper });
    result.current.mutate({ pageId: 'p1', commentId: 'c1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['albums', 'a1', 'pages', 'p1', 'comments'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['albums', 'a1', 'pages'] });
  });
});
