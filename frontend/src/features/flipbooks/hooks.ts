import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as albumsApi from './api';
import type { Album, AlbumFormInput, ReactionType, TopLevelComment } from './schemas';

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
      // exact: true — this key is also a prefix of the comments infinite
      // query's key (['albums', albumId, 'pages', pageId, 'comments']), and
      // invalidateQueries fuzzy-matches by default. Without it, this would
      // also invalidate (and silently refetch) any open comment thread.
      queryClient.invalidateQueries({ queryKey: ['albums', albumId, 'pages'], exact: true });
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
      // exact: true — this key is also a prefix of the comments infinite
      // query's key (['albums', albumId, 'pages', pageId, 'comments']), and
      // invalidateQueries fuzzy-matches by default. Without it, this would
      // also invalidate (and silently refetch) any open comment thread.
      queryClient.invalidateQueries({ queryKey: ['albums', albumId, 'pages'], exact: true });
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
      // exact: true — this key is also a prefix of the comments infinite
      // query's key (['albums', albumId, 'pages', pageId, 'comments']), and
      // invalidateQueries fuzzy-matches by default. Without it, this would
      // also invalidate (and silently refetch) any open comment thread.
      queryClient.invalidateQueries({ queryKey: ['albums', albumId, 'pages'], exact: true });
    },
  });
}

export function useSetCoverPhoto(albumId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pageId: string) => albumsApi.setCoverPhoto(albumId, pageId),
    onSuccess: (album) => {
      // setCover's response never resolves a reaction summary, so it parses
      // to the schema's zeroed default — preserve whatever was already
      // cached instead of overwriting a real love count with that default.
      queryClient.setQueryData<Album>(['albums', albumId], (previous) => ({
        ...album,
        reactions: previous?.reactions ?? album.reactions,
      }));
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
      // exact: true — this key is also a prefix of the comments infinite
      // query's key (['albums', albumId, 'pages', pageId, 'comments']), and
      // invalidateQueries fuzzy-matches by default. Without it, this would
      // also invalidate (and silently refetch) any open comment thread.
      queryClient.invalidateQueries({ queryKey: ['albums', albumId, 'pages'], exact: true });
    },
  });
}

export function useSetAlbumReaction(albumId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => albumsApi.setAlbumReaction(albumId),
    onSuccess: (reactions) => {
      // The endpoint already returns the fresh summary, so write it straight
      // into the cached album rather than refetching the whole album.
      queryClient.setQueryData<Album>(['albums', albumId], (album) =>
        album ? { ...album, reactions } : album
      );
      // The owner's own gallery list shows the same count on its cards —
      // invalidated (not written) since a mutation here doesn't know which
      // list page/filter is currently in view.
      queryClient.invalidateQueries({ queryKey: ['albums', 'list'] });
    },
  });
}

type CommentsPage = { comments: TopLevelComment[]; hasMore: boolean };
// createdAt + id of the oldest comment in the last-fetched portion — id
// tiebreaks comments that share the exact same createdAt millisecond, so a
// page boundary can't fall inside a tied group and silently skip comments.
type CommentsCursor = { createdAt: string; id: string };
type CommentsQueryData = InfiniteData<CommentsPage, CommentsCursor | undefined>;

function commentsQueryKey(albumId: string | undefined, pageId: string | undefined) {
  return ['albums', albumId, 'pages', pageId, 'comments'] as const;
}

// Lazily fetched — only enabled while the viewer actually has a photo's
// comment thread expanded, so opening the lightbox (or paging through
// photos) never fires a comments request nobody asked to see.
//
// Paginated newest-portion-first (see listComments on the backend): the
// first page is the most recent COMMENTS_PAGE_SIZE comments, and each
// subsequent page (fetched via fetchMore, driven by CommentControl's "See
// earlier comments" button) reaches further back in time. pages[0] is
// always the newest portion, so displaying the thread oldest-to-newest
// means reversing the page order before flattening.
export function useComments(albumId: string | undefined, pageId: string | undefined, enabled: boolean) {
  const query = useInfiniteQuery({
    queryKey: commentsQueryKey(albumId, pageId),
    queryFn: ({ pageParam }: { pageParam: CommentsCursor | undefined }) =>
      albumsApi.listComments(albumId!, pageId!, pageParam?.createdAt, pageParam?.id),
    initialPageParam: undefined as CommentsCursor | undefined,
    // The oldest comment in the just-fetched portion becomes the cursor for
    // the next (older) one; undefined once the backend reports no more.
    getNextPageParam: (lastPage) => {
      const oldest = lastPage.comments[0];
      return lastPage.hasMore && oldest ? { createdAt: oldest.createdAt, id: oldest._id } : undefined;
    },
    enabled: enabled && albumId !== undefined && pageId !== undefined,
  });

  // Deduped by _id: a comment posted right at the boundary between two
  // already-loaded portions could otherwise briefly render twice if a
  // refetch shifts where that boundary falls.
  const comments = useMemo(() => {
    const seen = new Set<string>();
    const flattened: TopLevelComment[] = [];
    for (const page of [...(query.data?.pages ?? [])].reverse()) {
      for (const comment of page.comments) {
        if (seen.has(comment._id)) continue;
        seen.add(comment._id);
        flattened.push(comment);
      }
    }
    return flattened;
  }, [query.data]);

  return {
    comments,
    isLoading: query.isLoading,
    // A failed "See earlier comments" fetch also sets react-query's overall
    // isError, even though the portions already loaded are still sitting in
    // `data` untouched — only treat it as a full-panel failure when nothing
    // has loaded at all. The fetch-more case surfaces as hasFetchMoreError
    // instead, next to the button, so a transient failure while paging back
    // through history can't wipe an already-visible thread.
    isError: query.isError && comments.length === 0,
    hasFetchMoreError: query.isError && comments.length > 0,
    hasMoreComments: query.hasNextPage,
    isFetchingMoreComments: query.isFetchingNextPage,
    fetchMoreComments: query.fetchNextPage,
  };
}

export function useAddComment(albumId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, text, parentCommentId }: { pageId: string; text: string; parentCommentId?: string }) =>
      albumsApi.addComment(albumId, pageId, text, parentCommentId),
    onSuccess: (result, { pageId }) => {
      // Patched directly into the cache rather than invalidated —
      // re-deriving every already-loaded page's cursor from scratch on a
      // refetch can shift where page boundaries fall and drop an
      // already-visible older comment that no longer lands in any of the
      // refetched pages. The mutation response is already the source of
      // truth for what changed, so there's nothing a refetch would add.
      queryClient.setQueryData<CommentsQueryData>(commentsQueryKey(albumId, pageId), (previous) => {
        if (!previous) return previous;

        // A reply — one level deep, so it always answers a top-level
        // comment (never another reply) — is appended into that parent's
        // own replies array, wherever that parent happens to be loaded.
        if (result.comment.parentComment) {
          const parentId = result.comment.parentComment;
          return {
            ...previous,
            pages: previous.pages.map((page) => ({
              ...page,
              comments: page.comments.map((comment) =>
                comment._id === parentId ? { ...comment, replies: [...comment.replies, result.comment] } : comment
              ),
            })),
          };
        }

        // A top-level comment always belongs on the newest (first) page.
        const [firstPage, ...rest] = previous.pages;
        if (!firstPage) return previous;
        const newTopLevelComment = { ...result.comment, replies: [], hasMoreReplies: false };
        return { ...previous, pages: [{ ...firstPage, comments: [...firstPage.comments, newTopLevelComment] }, ...rest] };
      });
      // The page list's commentCount lives alongside reactions on each page
      // object — invalidated the same way useSetPageReaction invalidates it.
      // exact: true — this key is also a prefix of the comments infinite
      // query's key (['albums', albumId, 'pages', pageId, 'comments']), and
      // invalidateQueries fuzzy-matches by default. Without it, this would
      // also invalidate (and silently refetch) any open comment thread.
      queryClient.invalidateQueries({ queryKey: ['albums', albumId, 'pages'], exact: true });
    },
  });
}

export function useDeleteComment(albumId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, commentId }: { pageId: string; commentId: string }) =>
      albumsApi.deleteComment(albumId, pageId, commentId),
    onSuccess: (_result, { pageId, commentId }) => {
      // Same reasoning as useAddComment: filtered out of whichever loaded
      // page (or, for a reply, whichever top-level comment's replies array)
      // holds it, rather than invalidated — an unrelated already-loaded
      // older portion can't be dropped by a refetch recomputing page
      // boundaries from scratch. Each page's own hasMore/cursor is left
      // alone — cursors are fixed at fetch time and unaffected by removing
      // an item from what's currently displayed.
      queryClient.setQueryData<CommentsQueryData>(commentsQueryKey(albumId, pageId), (previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          pages: previous.pages.map((page) => ({
            ...page,
            comments: page.comments
              .filter((comment) => comment._id !== commentId)
              .map((comment) => ({
                ...comment,
                replies: comment.replies.filter((reply) => reply._id !== commentId),
              })),
          })),
        };
      });
      // exact: true — this key is also a prefix of the comments infinite
      // query's key (['albums', albumId, 'pages', pageId, 'comments']), and
      // invalidateQueries fuzzy-matches by default. Without it, this would
      // also invalidate (and silently refetch) any open comment thread.
      queryClient.invalidateQueries({ queryKey: ['albums', albumId, 'pages'], exact: true });
    },
  });
}

export function useSetCommentReaction(albumId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, commentId, type }: { pageId: string; commentId: string; type: ReactionType }) =>
      albumsApi.setCommentReaction(albumId, pageId, commentId, type),
    onSuccess: (reactions, { pageId, commentId }) => {
      // Patched directly into the cache, not invalidated — same reasoning as
      // useAddComment/useDeleteComment: a refetch could shift where
      // already-loaded pages' cursors fall. Unlike those two, this never
      // changes comments.length or which comment is newest, so it can't
      // disturb CommentControl's scroll-position-preservation effect either.
      queryClient.setQueryData<CommentsQueryData>(commentsQueryKey(albumId, pageId), (previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          pages: previous.pages.map((page) => ({
            ...page,
            comments: page.comments.map((comment) => {
              if (comment._id === commentId) return { ...comment, reactions };
              return {
                ...comment,
                replies: comment.replies.map((reply) =>
                  reply._id === commentId ? { ...reply, reactions } : reply
                ),
              };
            }),
          })),
        };
      });
    },
  });
}

// Further portions of a single comment's replies, beyond the first page
// already embedded by useComments/attachReplies — driven by CommentControl's
// "Load more replies" button, same "load more" shape as
// useComments/fetchMoreComments but scoped to one comment instead of the
// whole thread.
export function useLoadMoreReplies(albumId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, commentId }: { pageId: string; commentId: string }) => {
      // The cursor is the newest reply currently loaded for this comment,
      // read fresh from the cache rather than passed in by the caller —
      // CommentControl only ever offers this action once a comment's first
      // page of replies is already showing, so there's always a real
      // cursor to page forward from.
      const cached = queryClient.getQueryData<CommentsQueryData>(commentsQueryKey(albumId, pageId));
      const comment = cached?.pages.flatMap((page) => page.comments).find((c) => c._id === commentId);
      const lastLoadedReply = comment?.replies[comment.replies.length - 1];
      return albumsApi.listReplies(albumId, pageId, commentId, lastLoadedReply?.createdAt, lastLoadedReply?._id);
    },
    onSuccess: (result, { pageId, commentId }) => {
      // Patched directly into the cache rather than invalidated — same
      // reasoning as useAddComment: nothing a refetch would add beyond what
      // this response already carries.
      queryClient.setQueryData<CommentsQueryData>(commentsQueryKey(albumId, pageId), (previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          pages: previous.pages.map((page) => ({
            ...page,
            comments: page.comments.map((comment) =>
              comment._id === commentId
                ? { ...comment, replies: [...comment.replies, ...result.replies], hasMoreReplies: result.hasMore }
                : comment
            ),
          })),
        };
      });
    },
  });
}

export function useArchiveAlbum(albumId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (archived: boolean) => albumsApi.archiveAlbum(albumId, archived),
    onSuccess: (album) => {
      // update's response never resolves a reaction summary either — same
      // preserve-what-was-cached reasoning as useSetCoverPhoto above.
      queryClient.setQueryData<Album>(['albums', albumId], (previous) => ({
        ...album,
        reactions: previous?.reactions ?? album.reactions,
      }));
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
