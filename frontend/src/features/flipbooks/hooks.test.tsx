import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useSetCoverPhoto, useArchiveAlbum, useAddComment, useDeleteComment, useComments } from './hooks';
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

describe('useComments', () => {
  // react-query's overall isError flips true on ANY failed page fetch,
  // including a fetchNextPage call — without the isError/hasFetchMoreError
  // split, a failed "See earlier comments" request would blow away the
  // portion that was already loaded and rendering fine.
  test('a failed "load more" surfaces as hasFetchMoreError, without wiping the already-loaded comments or flipping isError', async () => {
    const EXISTING_COMMENT = {
      _id: 'c1',
      page: 'p1',
      user: 'u1',
      username: 'maria',
      avatarUrl: null,
      text: 'Lovely!',
      parentComment: null,
      createdAt: new Date().toISOString(),
      replies: [],
    };
    vi.mocked(fetch).mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('before=')) return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: 'fail' }) } as Response);
      return respond({ comments: [EXISTING_COMMENT], hasMore: true });
    });
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useComments('a1', 'p1', true), { wrapper });

    await waitFor(() => expect(result.current.comments).toEqual([EXISTING_COMMENT]));
    expect(result.current.isError).toBe(false);

    result.current.fetchMoreComments();

    await waitFor(() => expect(result.current.hasFetchMoreError).toBe(true));
    expect(result.current.isError).toBe(false);
    expect(result.current.comments).toEqual([EXISTING_COMMENT]);
    expect(result.current.hasMoreComments).toBe(true);
  });
});

// Shared shape for a comments infinite query's cache — matches what
// useComments (hooks.ts) actually stores via useInfiniteQuery.
const COMMENTS_QUERY_KEY = ['albums', 'a1', 'pages', 'p1', 'comments'];
function seedCommentsCache(
  queryClient: ReturnType<typeof createTestQueryClient>,
  pages: Array<{ comments: Array<{ _id: string; [key: string]: unknown }>; hasMore: boolean }>
) {
  queryClient.setQueryData(COMMENTS_QUERY_KEY, {
    pages,
    pageParams: pages.map((_, index) => (index === 0 ? undefined : `cursor-${index}`)),
  });
}

describe('useAddComment', () => {
  const NEW_COMMENT = {
    _id: 'c-new',
    page: 'p1',
    user: 'u1',
    username: 'maria',
    avatarUrl: null,
    text: 'Nice!',
    parentComment: null,
    createdAt: new Date().toISOString(),
  };

  // A blanket invalidate would re-run getNextPageParam from scratch on
  // fresh data for every already-loaded page — which can shift where page
  // boundaries fall and drop an already-visible older comment that no
  // longer lands in any of the refetched pages. Patching directly into the
  // cached newest page avoids that entirely: no refetch, no boundary
  // recompute, nothing to lose.
  test('appends the new comment to the first cached page instead of invalidating the thread', async () => {
    vi.mocked(fetch).mockImplementation(() => respond({ comment: NEW_COMMENT, commentCount: 2 }));
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const EXISTING = { _id: 'c1', text: 'Older one' };
    seedCommentsCache(queryClient, [{ comments: [EXISTING], hasMore: false }]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useAddComment('a1'), { wrapper });
    result.current.mutate({ pageId: 'p1', text: 'Nice!' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Merged in as a fresh top-level comment (its own replies array starts
    // empty) — everything already cached passes through unchanged.
    expect(queryClient.getQueryData(COMMENTS_QUERY_KEY)).toEqual({
      pages: [{ comments: [EXISTING, { ...NEW_COMMENT, replies: [] }], hasMore: false }],
      pageParams: [undefined],
    });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: COMMENTS_QUERY_KEY });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['albums', 'a1', 'pages'] });
  });

  // A second (older) already-loaded page must survive untouched — this is
  // the exact scenario a blanket invalidate could corrupt.
  test('leaves already-loaded older pages untouched', async () => {
    vi.mocked(fetch).mockImplementation(() => respond({ comment: NEW_COMMENT, commentCount: 3 }));
    const queryClient = createTestQueryClient();
    const NEWEST_PAGE_COMMENT = { _id: 'c2', text: 'Newest so far' };
    const OLDER_PAGE_COMMENT = { _id: 'c1', text: 'From the older, already-loaded page' };
    seedCommentsCache(queryClient, [
      { comments: [NEWEST_PAGE_COMMENT], hasMore: true },
      { comments: [OLDER_PAGE_COMMENT], hasMore: false },
    ]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useAddComment('a1'), { wrapper });
    result.current.mutate({ pageId: 'p1', text: 'Nice!' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cached = queryClient.getQueryData<{ pages: Array<{ comments: unknown[] }> }>(COMMENTS_QUERY_KEY);
    expect(cached?.pages[0].comments).toEqual([NEWEST_PAGE_COMMENT, { ...NEW_COMMENT, replies: [] }]);
    expect(cached?.pages[1].comments).toEqual([OLDER_PAGE_COMMENT]);
  });

  test('does not crash when the thread was never fetched (no cached data to patch)', async () => {
    vi.mocked(fetch).mockImplementation(() => respond({ comment: NEW_COMMENT, commentCount: 1 }));
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useAddComment('a1'), { wrapper });
    result.current.mutate({ pageId: 'p1', text: 'Nice!' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(COMMENTS_QUERY_KEY)).toBeUndefined();
  });

  test('appends a reply into its parent comment\'s replies array, wherever that parent is loaded', async () => {
    const REPLY = { ...NEW_COMMENT, _id: 'reply1', text: 'Thanks!', parentComment: 'c1' };
    vi.mocked(fetch).mockImplementation(() => respond({ comment: REPLY, commentCount: 2 }));
    const queryClient = createTestQueryClient();
    const PARENT = { _id: 'c1', text: 'Original comment', replies: [] };
    const UNRELATED = { _id: 'c2', text: 'Unrelated comment', replies: [] };
    seedCommentsCache(queryClient, [{ comments: [UNRELATED, PARENT], hasMore: false }]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useAddComment('a1'), { wrapper });
    result.current.mutate({ pageId: 'p1', text: 'Thanks!', parentCommentId: 'c1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cached = queryClient.getQueryData<{ pages: Array<{ comments: unknown[] }> }>(COMMENTS_QUERY_KEY);
    expect(cached?.pages[0].comments).toEqual([UNRELATED, { ...PARENT, replies: [REPLY] }]);
  });
});

describe('useDeleteComment', () => {
  test('removes the deleted comment from its cached page instead of invalidating the thread', async () => {
    vi.mocked(fetch).mockImplementation(() => respond({ deleted: true, commentCount: 1 }));
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const KEEP = { _id: 'c-keep', text: 'Stays', replies: [] };
    const REMOVE = { _id: 'c1', text: 'Goes', replies: [] };
    seedCommentsCache(queryClient, [{ comments: [REMOVE, KEEP], hasMore: false }]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDeleteComment('a1'), { wrapper });
    result.current.mutate({ pageId: 'p1', commentId: 'c1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(COMMENTS_QUERY_KEY)).toEqual({
      pages: [{ comments: [KEEP], hasMore: false }],
      pageParams: [undefined],
    });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: COMMENTS_QUERY_KEY });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['albums', 'a1', 'pages'] });
  });

  // Same "an unrelated already-loaded page must survive" regression as
  // useAddComment above, but for a deletion landing in the older page.
  test('leaves an unrelated, already-loaded page untouched', async () => {
    vi.mocked(fetch).mockImplementation(() => respond({ deleted: true, commentCount: 1 }));
    const queryClient = createTestQueryClient();
    const NEWEST_PAGE_COMMENT = { _id: 'c2', text: 'Newest so far', replies: [] };
    const OLDER_PAGE_KEEP = { _id: 'c-keep', text: 'Stays', replies: [] };
    const OLDER_PAGE_REMOVE = { _id: 'c1', text: 'Goes', replies: [] };
    seedCommentsCache(queryClient, [
      { comments: [NEWEST_PAGE_COMMENT], hasMore: true },
      { comments: [OLDER_PAGE_REMOVE, OLDER_PAGE_KEEP], hasMore: false },
    ]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDeleteComment('a1'), { wrapper });
    result.current.mutate({ pageId: 'p1', commentId: 'c1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cached = queryClient.getQueryData<{ pages: Array<{ comments: unknown[] }> }>(COMMENTS_QUERY_KEY);
    expect(cached?.pages[0].comments).toEqual([NEWEST_PAGE_COMMENT]);
    expect(cached?.pages[1].comments).toEqual([OLDER_PAGE_KEEP]);
  });

  test('removes a reply from its parent comment\'s replies array, leaving the parent itself in place', async () => {
    vi.mocked(fetch).mockImplementation(() => respond({ deleted: true, commentCount: 1 }));
    const queryClient = createTestQueryClient();
    const KEEP_REPLY = { _id: 'reply-keep', text: 'Stays' };
    const REMOVE_REPLY = { _id: 'reply-remove', text: 'Goes' };
    const PARENT = { _id: 'c1', text: 'Original comment', replies: [REMOVE_REPLY, KEEP_REPLY] };
    seedCommentsCache(queryClient, [{ comments: [PARENT], hasMore: false }]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDeleteComment('a1'), { wrapper });
    result.current.mutate({ pageId: 'p1', commentId: 'reply-remove' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cached = queryClient.getQueryData<{ pages: Array<{ comments: unknown[] }> }>(COMMENTS_QUERY_KEY);
    expect(cached?.pages[0].comments).toEqual([{ ...PARENT, replies: [KEEP_REPLY] }]);
  });
});
