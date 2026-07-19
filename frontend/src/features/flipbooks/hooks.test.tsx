import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useSetCoverPhoto,
  useArchiveAlbum,
  useAddComment,
  useDeleteComment,
  useSetCommentReaction,
  useLoadMoreReplies,
  useComments,
} from './hooks';
import type { Album } from './schemas';
import { createTestQueryClient } from '../../tests/test-utils';
import { tokenStorage } from '../../lib/api-client';

const ZERO_REACTIONS = {
  counts: { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
  total: 0,
  viewerReaction: null,
  reactors: [],
};

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
      reactions: ZERO_REACTIONS,
      createdAt: new Date().toISOString(),
      replies: [],
      hasMoreReplies: false,
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

  // beforeId tiebreaks comments sharing the exact same createdAt millisecond
  // — omitting it would let a page boundary fall inside a tied group and
  // silently skip comments (see listComments on the backend).
  test('"load more" sends both the oldest comment\'s createdAt and its id as the cursor', async () => {
    const EXISTING_COMMENT = {
      _id: 'c1',
      page: 'p1',
      user: 'u1',
      username: 'maria',
      avatarUrl: null,
      text: 'Lovely!',
      parentComment: null,
      reactions: ZERO_REACTIONS,
      createdAt: '2025-01-01T00:00:00.000Z',
      replies: [],
      hasMoreReplies: false,
    };
    const requestedUrls: string[] = [];
    vi.mocked(fetch).mockImplementation((url) => {
      requestedUrls.push(String(url));
      return respond({ comments: [EXISTING_COMMENT], hasMore: true });
    });
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useComments('a1', 'p1', true), { wrapper });
    await waitFor(() => expect(result.current.comments).toEqual([EXISTING_COMMENT]));

    result.current.fetchMoreComments();
    await waitFor(() => expect(requestedUrls.length).toBe(2));

    const secondRequestUrl = requestedUrls[1];
    expect(secondRequestUrl).toContain(`before=${encodeURIComponent(EXISTING_COMMENT.createdAt)}`);
    expect(secondRequestUrl).toContain(`beforeId=${EXISTING_COMMENT._id}`);
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
    reactions: ZERO_REACTIONS,
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
      pages: [{ comments: [EXISTING, { ...NEW_COMMENT, replies: [], hasMoreReplies: false }], hasMore: false }],
      pageParams: [undefined],
    });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: COMMENTS_QUERY_KEY });
    // exact: true is load-bearing here, not incidental: ['albums', 'a1',
    // 'pages'] is a prefix of COMMENTS_QUERY_KEY, and invalidateQueries
    // fuzzy-matches by default — without it this call would also invalidate
    // (and silently refetch) the very thread just patched above.
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['albums', 'a1', 'pages'], exact: true });
  });

  test('does not invalidate an open comments thread — the pages-list key is a prefix of the comments key', async () => {
    vi.mocked(fetch).mockImplementation(() => respond({ comment: NEW_COMMENT, commentCount: 2 }));
    const queryClient = createTestQueryClient();
    const EXISTING = { _id: 'c1', text: 'Older one' };
    seedCommentsCache(queryClient, [{ comments: [EXISTING], hasMore: false }]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // An active observer on the comments query is what actually turns a
    // fuzzy-matched invalidation into a background refetch — asserting only
    // on the invalidateQueries call arguments (as the test above does)
    // can't catch that, since a plain object-equality check doesn't know
    // about react-query's own prefix-matching. useComments' `enabled` flag
    // mirrors the real app: it's only ever mounted while the panel is open.
    const { result: commentsResult } = renderHook(() => useComments('a1', 'p1', true), { wrapper });
    await waitFor(() => expect(commentsResult.current.isLoading).toBe(false));
    vi.mocked(fetch).mockClear();

    const { result } = renderHook(() => useAddComment('a1'), { wrapper });
    result.current.mutate({ pageId: 'p1', text: 'Nice!' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryState(COMMENTS_QUERY_KEY)?.isInvalidated).toBe(false);
    // Exactly the one POST from the mutation itself — a redundant GET
    // refetch of the comments thread would show up as a second call here.
    expect(fetch).toHaveBeenCalledTimes(1);
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
    expect(cached?.pages[0].comments).toEqual([NEWEST_PAGE_COMMENT, { ...NEW_COMMENT, replies: [], hasMoreReplies: false }]);
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
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['albums', 'a1', 'pages'], exact: true });
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

describe('useSetCommentReaction', () => {
  const NEW_REACTIONS = {
    counts: { like: 0, love: 1, haha: 0, wow: 0, sad: 0, angry: 0 },
    total: 1,
    viewerReaction: 'love' as const,
    reactors: [{ username: 'maria', type: 'love' as const }],
  };

  test('patches the reacted-to top-level comment in its cached page instead of invalidating the thread', async () => {
    vi.mocked(fetch).mockImplementation(() => respond({ reactions: NEW_REACTIONS }));
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const REACTED = { _id: 'c1', text: 'Lovely!', replies: [] };
    const UNRELATED = { _id: 'c2', text: 'Unrelated', replies: [] };
    seedCommentsCache(queryClient, [{ comments: [REACTED, UNRELATED], hasMore: false }]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSetCommentReaction('a1'), { wrapper });
    result.current.mutate({ pageId: 'p1', commentId: 'c1', type: 'love' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cached = queryClient.getQueryData<{ pages: Array<{ comments: unknown[] }> }>(COMMENTS_QUERY_KEY);
    expect(cached?.pages[0].comments).toEqual([
      { ...REACTED, reactions: NEW_REACTIONS },
      UNRELATED,
    ]);
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: COMMENTS_QUERY_KEY });
  });

  test('patches a reacted-to reply within its parent\'s replies array, leaving sibling replies untouched', async () => {
    vi.mocked(fetch).mockImplementation(() => respond({ reactions: NEW_REACTIONS }));
    const queryClient = createTestQueryClient();
    const REACTED_REPLY = { _id: 'reply1', text: 'Totally agree!' };
    const SIBLING_REPLY = { _id: 'reply2', text: 'Me too' };
    const PARENT = { _id: 'c1', text: 'Original comment', replies: [REACTED_REPLY, SIBLING_REPLY] };
    seedCommentsCache(queryClient, [{ comments: [PARENT], hasMore: false }]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSetCommentReaction('a1'), { wrapper });
    result.current.mutate({ pageId: 'p1', commentId: 'reply1', type: 'love' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cached = queryClient.getQueryData<{ pages: Array<{ comments: unknown[] }> }>(COMMENTS_QUERY_KEY);
    expect(cached?.pages[0].comments).toEqual([
      { ...PARENT, replies: [{ ...REACTED_REPLY, reactions: NEW_REACTIONS }, SIBLING_REPLY] },
    ]);
  });

  test('does not crash when the thread was never fetched (no cached data to patch)', async () => {
    vi.mocked(fetch).mockImplementation(() => respond({ reactions: NEW_REACTIONS }));
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSetCommentReaction('a1'), { wrapper });
    result.current.mutate({ pageId: 'p1', commentId: 'c1', type: 'love' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(COMMENTS_QUERY_KEY)).toBeUndefined();
  });
});

describe('useLoadMoreReplies', () => {
  const NEW_REPLIES = [
    {
      _id: 'reply2',
      page: 'p1',
      user: 'u2',
      username: 'sam',
      avatarUrl: null,
      text: 'Another reply',
      parentComment: 'c1',
      reactions: ZERO_REACTIONS,
      createdAt: '2025-01-02T00:00:00.000Z',
    },
  ];

  test('reads the cursor from the last loaded reply, appends the new portion, and updates hasMoreReplies', async () => {
    const requestedUrls: string[] = [];
    vi.mocked(fetch).mockImplementation((url) => {
      requestedUrls.push(String(url));
      return respond({ replies: NEW_REPLIES, hasMore: false });
    });
    const queryClient = createTestQueryClient();
    const LAST_LOADED_REPLY = { _id: 'reply1', text: 'First reply', createdAt: '2025-01-01T00:00:00.000Z' };
    const PARENT = { _id: 'c1', text: 'Original comment', replies: [LAST_LOADED_REPLY], hasMoreReplies: true };
    seedCommentsCache(queryClient, [{ comments: [PARENT], hasMore: false }]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useLoadMoreReplies('a1'), { wrapper });
    result.current.mutate({ pageId: 'p1', commentId: 'c1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The cursor is read fresh from the cache, not passed in by the caller
    // — see useLoadMoreReplies.
    expect(requestedUrls[0]).toContain(`after=${encodeURIComponent(LAST_LOADED_REPLY.createdAt)}`);
    expect(requestedUrls[0]).toContain(`afterId=${LAST_LOADED_REPLY._id}`);

    const cached = queryClient.getQueryData<{ pages: Array<{ comments: unknown[] }> }>(COMMENTS_QUERY_KEY);
    expect(cached?.pages[0].comments).toEqual([
      { ...PARENT, replies: [LAST_LOADED_REPLY, ...NEW_REPLIES], hasMoreReplies: false },
    ]);
  });

  test('leaves an unrelated comment\'s replies untouched', async () => {
    vi.mocked(fetch).mockImplementation(() => respond({ replies: NEW_REPLIES, hasMore: false }));
    const queryClient = createTestQueryClient();
    const TARGET_REPLY = { _id: 'reply1', text: 'First reply', createdAt: '2025-01-01T00:00:00.000Z' };
    const TARGET = { _id: 'c1', text: 'Target comment', replies: [TARGET_REPLY], hasMoreReplies: true };
    const UNRELATED_REPLY = { _id: 'reply-other', text: 'Someone else\'s reply', createdAt: '2025-01-01T00:00:00.000Z' };
    const UNRELATED = { _id: 'c2', text: 'Unrelated comment', replies: [UNRELATED_REPLY], hasMoreReplies: true };
    seedCommentsCache(queryClient, [{ comments: [TARGET, UNRELATED], hasMore: false }]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useLoadMoreReplies('a1'), { wrapper });
    result.current.mutate({ pageId: 'p1', commentId: 'c1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cached = queryClient.getQueryData<{ pages: Array<{ comments: unknown[] }> }>(COMMENTS_QUERY_KEY);
    expect(cached?.pages[0].comments[1]).toEqual(UNRELATED);
  });

  test('does not crash when the thread was never fetched (no cached data to patch)', async () => {
    vi.mocked(fetch).mockImplementation(() => respond({ replies: NEW_REPLIES, hasMore: false }));
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useLoadMoreReplies('a1'), { wrapper });
    result.current.mutate({ pageId: 'p1', commentId: 'c1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(COMMENTS_QUERY_KEY)).toBeUndefined();
  });
});
