import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import PhotoLightbox from '../../../components/PhotoLightbox';
import AlbumLoveButton from '../../../components/AlbumLoveButton';
import ReactorsModal from '../../../components/ReactorsModal';
import { toast } from '../../../lib/toast';
import AlbumSpread, { AUTOPLAY_INTERVAL_MS } from '../components/AlbumSpread';
import { useMe } from '../../auth';
import {
  useAlbum,
  usePages,
  useSetPageReaction,
  useSetAlbumReaction,
  useComments,
  useAddComment,
  useDeleteComment,
  useSetCommentReaction,
  useLoadMoreReplies,
  type ReactionType,
} from '../../flipbooks';

export default function ViewerPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const deepLinkedPhotoId = searchParams.get('photo');
  const { data: me } = useMe();
  const { data: album, isLoading, isError, error } = useAlbum(id);
  const { data: pagesData } = usePages(id);
  const pages = pagesData ?? [];
  const hasPhotos = pages.length > 0;

  const setReaction = useSetPageReaction(id ?? '');
  const handleReact = (pageId: string, type: ReactionType) => {
    setReaction.mutate(
      { pageId, type },
      { onError: (mutationError) => toast.error(mutationError.message) }
    );
  };

  const setAlbumReaction = useSetAlbumReaction(id ?? '');
  const handleToggleAlbumLove = () => {
    setAlbumReaction.mutate(undefined, {
      onError: (mutationError) => toast.error(mutationError.message),
    });
  };

  // The backend already lets an Admin delete any comment (isOwnerOrAdmin) —
  // mirror that here so the delete button isn't hidden from an Admin who's
  // landed on someone else's album, same as CircleDetailPage's canManage.
  const isAlbumOwner =
    album !== undefined &&
    me !== undefined &&
    (album.owner === me._id || me.roles.includes('Admin'));

  // Tracked by photo id, not array index — a raw index would go stale (and
  // could silently point at an unrelated photo) if the page list changes
  // while the lightbox is open. Seeded from ?photo=<pageId> so a notification
  // (or any other link) can deep-link straight to a specific photo; falls
  // back to the first photo when absent, same as before this existed. Only
  // re-seeds when the album or the query param itself changes — not on every
  // in-viewer navigation, which sets photoId directly via setPhotoId.
  const [photoId, setPhotoId] = useState<string | null>(deepLinkedPhotoId);
  useEffect(() => setPhotoId(deepLinkedPhotoId), [id, deepLinkedPhotoId]);
  const selectedIndex = pages.findIndex((page) => page._id === photoId);
  const currentIndex = selectedIndex !== -1 ? selectedIndex : 0;
  const currentPhoto = pages[currentIndex];
  // Stable across re-renders — AlbumSpread's autoplay timer depends on this
  // identity to know when to restart, so a fresh function every render
  // (from an inline arrow here) would reset that timer on any unrelated
  // re-render of this page, and autoplay would never actually get 5
  // uninterrupted seconds to fire.
  const navigateToIndex = useCallback(
    (index: number) => setPhotoId(pagesData?.[index]?._id ?? null),
    // pagesData (not the `pages` fallback above) — react-query keeps this
    // reference stable across renders as long as the data hasn't actually
    // changed, where `pagesData ?? []` would mint a new array every render
    // whenever there's no data yet.
    [pagesData]
  );

  // Gates the comment thread's fetch — only enabled while the lightbox's
  // comment panel is actually expanded, so opening the lightbox or paging
  // through photos never fires a request for a thread nobody asked to see.
  // CommentControl resets this back to false itself (via onCommentsOpenChange)
  // whenever the underlying photo changes.
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const {
    comments,
    isLoading: isCommentsLoading,
    isError: isCommentsError,
    hasFetchMoreError,
    hasMoreComments,
    isFetchingMoreComments,
    fetchMoreComments,
  } = useComments(id, currentPhoto?._id, isCommentsOpen);

  // Owned here (not inside AlbumSpread) so the header's play/pause button and
  // the spread's own auto-advance timer always agree on state. AlbumSpread
  // is still the one actually running the timer and flipping pages — it
  // calls this back to false the moment the viewer stops being a passive
  // slideshow (manual navigation, the lightbox opening, the tab going
  // background). Declared before the comments handlers below, which also
  // stop it — opening the comment panel to type is exactly the kind of
  // "viewer taking the wheel" autoplay should yield to.
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  // When the current countdown last (re)started — reported by AlbumSpread,
  // which owns the actual timer. PhotoLightbox mounts fresh every time the
  // viewer zooms in, so without this its own countdown bar would restart at
  // 0% instead of showing how much of the interval has really elapsed.
  const [autoPlayStartedAt, setAutoPlayStartedAt] = useState<number | undefined>(undefined);

  const addComment = useAddComment(id ?? '');
  // mutateAsync (not mutate) — CommentComposer awaits this promise directly
  // to know precisely when its own submission settles, rather than relying
  // on addComment.isPending's render timing (see CommentComposer). The
  // rejection this throws is already handled by the onError below and by
  // CommentComposer's own catch, so it's never left unhandled.
  const handleAddComment = (pageId: string, text: string, parentCommentId?: string) =>
    addComment
      .mutateAsync(
        { pageId, text, parentCommentId },
        { onError: (mutationError) => toast.error(mutationError.message) }
      )
      .then(() => undefined);
  // Which composer's submission is in flight/errored — the top-level
  // bottom composer (null) or a specific reply's inline composer (its
  // parent comment's id) — since addComment is one shared mutation across
  // every composer on the page (see the comment below), same "read the
  // target back off the mutation's own variables" trick as
  // pendingDeleteCommentId. Without this, a reply submitting would also
  // flash the top-level composer as pending (disabled, spinner) and show
  // the "couldn't post" banner underneath it, and vice versa.
  const pendingCommentTarget = addComment.isPending ? (addComment.variables?.parentCommentId ?? null) : undefined;
  const erroredCommentTarget = addComment.isError ? (addComment.variables?.parentCommentId ?? null) : undefined;
  // CommentControl's own effect re-fires onOpenChange whenever this
  // function's identity changes (same reset-tracking shape as its pageId
  // effect), so this must stay referentially stable across renders — a
  // fresh closure every render would loop: open state changes -> ViewerPage
  // re-renders -> new closure -> effect fires again -> ... A ref sidesteps
  // that without needing addComment (a fresh object every render) in a
  // dependency array.
  const addCommentRef = useRef(addComment);
  addCommentRef.current = addComment;
  // addComment is one shared mutation for the whole page, not scoped per
  // photo — its isError otherwise stays true (react-query only clears it on
  // the next mutate()) until the viewer submits again, so a failed post on
  // one photo would otherwise leak its error banner onto the next photo's
  // freshly opened, untouched comment panel.
  const handleCommentsOpenChange = useCallback((isOpen: boolean) => {
    setIsCommentsOpen(isOpen);
    if (isOpen) {
      // AlbumSpread's autoplay timer isn't gated by the lightbox's own
      // keyboard/button suspension (it deliberately keeps running behind a
      // zoomed-in photo) — without this, it would silently advance the
      // photo out from under an in-progress draft a few seconds later.
      setIsAutoPlaying(false);
    } else {
      addCommentRef.current.reset();
    }
  }, []);

  const deleteComment = useDeleteComment(id ?? '');
  const handleDeleteComment = (pageId: string, commentId: string) => {
    deleteComment.mutate(
      { pageId, commentId },
      { onError: (mutationError) => toast.error(mutationError.message) }
    );
  };
  const pendingDeleteCommentId = deleteComment.isPending
    ? (deleteComment.variables?.commentId ?? null)
    : null;

  const setCommentReaction = useSetCommentReaction(id ?? '');
  const handleReactToComment = (pageId: string, commentId: string, type: ReactionType) => {
    setCommentReaction.mutate(
      { pageId, commentId, type },
      { onError: (mutationError) => toast.error(mutationError.message) }
    );
  };
  const pendingReactionCommentId = setCommentReaction.isPending
    ? (setCommentReaction.variables?.commentId ?? null)
    : null;

  const loadMoreReplies = useLoadMoreReplies(id ?? '');
  const handleLoadMoreReplies = (pageId: string, commentId: string) => {
    loadMoreReplies.mutate(
      { pageId, commentId },
      { onError: (mutationError) => toast.error(mutationError.message) }
    );
  };
  const pendingRepliesCommentId = loadMoreReplies.isPending
    ? (loadMoreReplies.variables?.commentId ?? null)
    : null;
  const erroredRepliesCommentId = loadMoreReplies.isError
    ? (loadMoreReplies.variables?.commentId ?? null)
    : null;

  const [isReactorsModalOpen, setIsReactorsModalOpen] = useState(false);

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const openLightbox = () => {
    // Pin the lightbox to this specific photo (not just "whatever index 0
    // currently is") so the effect below can tell a real removal apart from
    // an ordinary refetch that leaves the same photo in place.
    setPhotoId(currentPhoto._id);
    setIsLightboxOpen(true);
    // Autoplay is left as-is: if it was running, AlbumSpread's timer keeps
    // advancing photos behind the zoomed-in view; if it was already
    // paused/stopped, zooming in stays a no-op.
  };
  // If the photo the lightbox is showing disappears from the list while it's
  // open (e.g. deleted from another tab), close it instead of silently
  // falling back to whatever photo now occupies index 0 — mirrors the
  // editor's own PagesPanel, which unmounts its lightbox the same way. Also
  // resets the comments panel state directly (CommentControl unmounts here
  // rather than closing itself, so its own onOpenChange(false) never fires)
  // so a stale error banner or an unwanted eager comments fetch can't
  // resurface the next time a (possibly different) photo's panel is opened.
  useEffect(() => {
    if (isLightboxOpen && selectedIndex === -1) {
      setIsLightboxOpen(false);
      setIsCommentsOpen(false);
      addCommentRef.current.reset();
    }
  }, [isLightboxOpen, selectedIndex]);

  // Autoplay reaching the last photo — stop rather than loop back to the
  // first one. Also backs out of the lightbox, which is a no-op if it wasn't
  // open. Stable identity, same reasoning as navigateToIndex above: it's in
  // AlbumSpread's timer's dependency array, so a fresh function every render
  // would restart that timer for no reason.
  const endAutoPlay = useCallback(() => {
    setIsAutoPlaying(false);
    setIsLightboxOpen(false);
  }, []);

  // Stop rather than silently keep advancing in a background tab — without
  // this, coming back could land many photos further along than expected.
  useEffect(() => {
    if (!isAutoPlaying) return;
    const handleVisibilityChange = () => {
      if (document.hidden) setIsAutoPlaying(false);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAutoPlaying]);

  return (
    <AppShell>
      <div className="p-gutter md:p-margin-edge">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-10 flex items-start justify-between">
            <div>
              <Link
                to="/flipbooks"
                className="font-ui text-ui-label uppercase text-on-surface-variant hover:text-secondary transition-colors flex items-center gap-2"
              >
                <Icon name="arrow_back" className="text-lg" />
                The Gallery
              </Link>
              {album && (
                <h2 className="font-display text-headline-md text-primary mt-2 italic">
                  {album.title}
                </h2>
              )}
            </div>
            <div className="flex items-center gap-6">
              {album && (
                <span className="font-body italic text-on-surface-variant text-sm">
                  {album.pageCount} pages
                </span>
              )}
              {album && (
                <AlbumLoveButton
                  isLoved={album.reactions.viewerReacted}
                  count={album.reactions.total}
                  onToggle={handleToggleAlbumLove}
                  onCountClick={() => setIsReactorsModalOpen(true)}
                  isPending={setAlbumReaction.isPending}
                />
              )}
              {pages.length > 1 && (
                <button
                  type="button"
                  onClick={() => setIsAutoPlaying((playing) => !playing)}
                  aria-label={isAutoPlaying ? 'Pause slideshow' : 'Play slideshow'}
                  title={isAutoPlaying ? 'Pause slideshow (Space)' : 'Play slideshow (Space)'}
                  className="shrink-0 w-12 h-12 rounded-full bg-surface-container-lowest border border-outline-variant/50 shadow-md flex items-center justify-center text-primary hover:border-secondary hover:text-secondary transition-colors focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
                >
                  <Icon name={isAutoPlaying ? 'pause' : 'play_arrow'} />
                </button>
              )}
              <Link
                to="/flipbooks"
                aria-label="Close volume"
                className="shrink-0 w-12 h-12 rounded-full bg-surface-container-lowest border border-outline-variant/50 shadow-md flex items-center justify-center text-primary hover:border-secondary hover:text-secondary transition-colors"
              >
                <Icon name="close" />
              </Link>
            </div>
          </div>

          {isLoading && (
            <p className="font-body italic text-on-surface-variant">Opening the volume…</p>
          )}
          {isError && (
            <p className="px-4 py-3 bg-error-container text-on-error-container rounded-paper font-ui text-sm inline-block">
              {error.message}
            </p>
          )}

          {album && (
            <AlbumSpread
              album={album}
              pages={pages}
              currentIndex={currentIndex}
              onNavigate={navigateToIndex}
              onOpenLightbox={openLightbox}
              onReact={handleReact}
              isReactionPending={setReaction.isPending}
              isKeyboardNavDisabled={isLightboxOpen || isReactorsModalOpen}
              viewerId={me?._id}
              viewerUsername={me?.username}
              isAutoPlaying={isAutoPlaying}
              onAutoPlayingChange={setIsAutoPlaying}
              onAutoPlayEnd={endAutoPlay}
              onAutoPlayTick={setAutoPlayStartedAt}
              comments={comments}
              isCommentsLoading={isCommentsLoading}
              isCommentsError={isCommentsError}
              onCommentsOpenChange={handleCommentsOpenChange}
              onAddComment={handleAddComment}
              pendingCommentTarget={pendingCommentTarget}
              erroredCommentTarget={erroredCommentTarget}
              onDeleteComment={handleDeleteComment}
              pendingDeleteCommentId={pendingDeleteCommentId}
              onReactToComment={handleReactToComment}
              pendingReactionCommentId={pendingReactionCommentId}
              isAlbumOwner={isAlbumOwner}
              hasMoreComments={hasMoreComments}
              isFetchingMoreComments={isFetchingMoreComments}
              hasFetchMoreCommentsError={hasFetchMoreError}
              onFetchMoreComments={fetchMoreComments}
              onLoadMoreReplies={handleLoadMoreReplies}
              pendingRepliesCommentId={pendingRepliesCommentId}
              erroredRepliesCommentId={erroredRepliesCommentId}
            />
          )}
        </div>
      </div>

      {isLightboxOpen && hasPhotos && (
        <PhotoLightbox
          photos={pages}
          index={currentIndex}
          onClose={() => setIsLightboxOpen(false)}
          onNavigate={navigateToIndex}
          onReact={handleReact}
          isReactionPending={setReaction.isPending}
          comments={comments}
          isCommentsLoading={isCommentsLoading}
          isCommentsError={isCommentsError}
          onCommentsOpenChange={handleCommentsOpenChange}
          onAddComment={handleAddComment}
          pendingCommentTarget={pendingCommentTarget}
          erroredCommentTarget={erroredCommentTarget}
          onDeleteComment={handleDeleteComment}
          pendingDeleteCommentId={pendingDeleteCommentId}
          onReactToComment={handleReactToComment}
          pendingReactionCommentId={pendingReactionCommentId}
          isAlbumOwner={isAlbumOwner}
          hasMoreComments={hasMoreComments}
          isFetchingMoreComments={isFetchingMoreComments}
          hasFetchMoreCommentsError={hasFetchMoreError}
          onFetchMoreComments={fetchMoreComments}
          onLoadMoreReplies={handleLoadMoreReplies}
          pendingRepliesCommentId={pendingRepliesCommentId}
          erroredRepliesCommentId={erroredRepliesCommentId}
          viewerId={me?._id}
          viewerUsername={me?.username}
          isAutoPlaying={isAutoPlaying}
          autoPlayIntervalMs={AUTOPLAY_INTERVAL_MS}
          autoPlayStartedAt={autoPlayStartedAt}
          onAutoPlayingChange={setIsAutoPlaying}
        />
      )}

      {album && (
        <ReactorsModal
          isOpen={isReactorsModalOpen}
          onClose={() => setIsReactorsModalOpen(false)}
          heading="People who loved this album"
          reactors={album.reactions.reactors.map((username) => ({ username, type: 'love' as const }))}
          viewerUsername={me?.username}
          onRemoveMyReaction={
            album.reactions.viewerReacted && !setAlbumReaction.isPending ? handleToggleAlbumLove : undefined
          }
        />
      )}
    </AppShell>
  );
}
