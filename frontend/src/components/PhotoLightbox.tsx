import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import ReactionControl from './ReactionControl';
import CommentControl from './CommentControl';
import useFocusTrap from '../hooks/useFocusTrap';
import type { ReactionSummary, ReactionType, TopLevelComment } from '../features/flipbooks';

type LightboxPhoto = {
  _id: string;
  url: string;
  filename?: string;
  caption?: string;
  // Reactions and comments are viewer-only (see ViewerPage) — absent when
  // the lightbox is opened from the editor's page-management view.
  reactions?: ReactionSummary;
  commentCount?: number;
};

type PhotoLightboxProps = {
  photos: LightboxPhoto[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onReact?: (pageId: string, type: ReactionType) => void;
  isReactionPending?: boolean;
  // Comments, like reactions, are viewer-only — all of the following are
  // omitted together when the lightbox is opened from the editor.
  comments?: TopLevelComment[];
  isCommentsLoading?: boolean;
  isCommentsError?: boolean;
  onCommentsOpenChange?: (isOpen: boolean) => void;
  onAddComment?: (pageId: string, text: string, parentCommentId?: string) => Promise<void>;
  // Which composer's submission is in flight/errored — null for the
  // top-level composer, a comment id for that comment's reply composer,
  // undefined for neither. See ViewerPage's pendingCommentTarget for why
  // this isn't just a flat boolean shared by every composer.
  pendingCommentTarget?: string | null;
  erroredCommentTarget?: string | null;
  onDeleteComment?: (pageId: string, commentId: string) => void;
  pendingDeleteCommentId?: string | null;
  onReactToComment?: (pageId: string, commentId: string, type: ReactionType) => void;
  pendingReactionCommentId?: string | null;
  isAlbumOwner?: boolean;
  hasMoreComments?: boolean;
  isFetchingMoreComments?: boolean;
  hasFetchMoreCommentsError?: boolean;
  onFetchMoreComments?: () => void;
  /** Drives comment ownership (delete button, "your comment" label) — a stable id, unlike viewerUsername below (kept separate for the reactor list, which has no ids to compare against). */
  viewerId?: string;
  viewerUsername?: string;
  // When the album viewer's slideshow keeps running behind the zoomed-in
  // photo, these mirror AlbumSpread's own progress bar so the countdown to
  // the next photo stays visible here too.
  isAutoPlaying?: boolean;
  autoPlayIntervalMs?: number;
  // When the current countdown last (re)started (Date.now(), from
  // AlbumSpread's own timer). This component mounts fresh every time the
  // viewer zooms in, so without this its countdown bar would always restart
  // its animation at 0% instead of resuming from how much of the interval
  // has actually already elapsed — visibly out of step with the timer that's
  // really driving the next page turn.
  autoPlayStartedAt?: number;
  // Manually paging through the lightbox's own arrows/keys should stop
  // autoplay rather than have the background timer fight the viewer on the
  // next tick — mirrors AlbumSpread's own prev/next buttons, which do the
  // same.
  onAutoPlayingChange?: (isAutoPlaying: boolean) => void;
};

export default function PhotoLightbox({
  photos,
  index,
  onClose,
  onNavigate,
  onReact,
  isReactionPending = false,
  comments,
  isCommentsLoading = false,
  isCommentsError = false,
  onCommentsOpenChange,
  onAddComment,
  pendingCommentTarget,
  erroredCommentTarget,
  onDeleteComment,
  pendingDeleteCommentId = null,
  onReactToComment,
  pendingReactionCommentId = null,
  isAlbumOwner = false,
  hasMoreComments = false,
  isFetchingMoreComments = false,
  hasFetchMoreCommentsError = false,
  onFetchMoreComments,
  viewerId,
  viewerUsername,
  isAutoPlaying = false,
  autoPlayIntervalMs,
  autoPlayStartedAt,
  onAutoPlayingChange,
}: PhotoLightboxProps) {
  const photo = photos[index];
  const hasPrevious = index > 0;
  const hasNext = index < photos.length - 1;
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, photo !== undefined);
  // While the photo's own "who reacted" list, or its comment thread, is open
  // on top, arrow keys should page through it (or do nothing), not also flip
  // the photo underneath — which would silently close either one out from
  // under the viewer via their own pageId-tracked reset.
  const [isReactorsModalOpen, setIsReactorsModalOpen] = useState(false);
  const [isCommentsPanelOpen, setIsCommentsPanelOpen] = useState(false);
  const handleCommentsOpenChange = useCallback(
    (isOpen: boolean) => {
      setIsCommentsPanelOpen(isOpen);
      onCommentsOpenChange?.(isOpen);
    },
    [onCommentsOpenChange]
  );

  // A manual move — same reasoning as AlbumSpread's own prev/next buttons.
  const navigate = useCallback(
    (newIndex: number) => {
      if (isAutoPlaying) onAutoPlayingChange?.(false);
      onNavigate(newIndex);
    },
    [isAutoPlaying, onAutoPlayingChange, onNavigate]
  );

  useEffect(() => {
    if (isReactorsModalOpen || isCommentsPanelOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && hasPrevious) navigate(index - 1);
      // On the last photo this wraps back to the first — mirrors the arrow
      // button below, which does the same instead of just going dead there.
      if (event.key === 'ArrowRight' && photos.length > 1) navigate(hasNext ? index + 1 : 0);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [index, hasPrevious, hasNext, photos.length, onClose, navigate, isReactorsModalOpen, isCommentsPanelOpen]);

  if (!photo) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-100 bg-black/90 flex flex-col items-center justify-center p-6"
      onClick={() => {
        if (!isCommentsPanelOpen) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        disabled={isCommentsPanelOpen}
        aria-label="Close photo viewer"
        className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors disabled:opacity-20 disabled:pointer-events-none"
      >
        <Icon name="close" className="text-2xl" />
      </button>

      <div
        className="flex items-center gap-4 md:gap-6 max-w-full max-h-full"
        onClick={(event) => event.stopPropagation()}
      >
        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => navigate(index - 1)}
            // Unlike the reactors modal (a backdrop-covering overlay that
            // already blocks clicks to what's behind it), the comments panel
            // is a plain inline element sitting beside these buttons — without
            // this, clicking Previous/Next while a comment is half-typed would
            // silently navigate and discard the draft.
            disabled={!hasPrevious || isCommentsPanelOpen}
            aria-label="Previous photo"
            className="shrink-0 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors disabled:opacity-20 disabled:pointer-events-none"
          >
            <Icon name="chevron_left" className="text-2xl" />
          </button>
        )}

        <div className="flex flex-col items-center gap-4 max-w-[80vw]">
          <div className="relative max-w-full">
            {isAutoPlaying && autoPlayIntervalMs !== undefined && (
              <div
                aria-hidden="true"
                className="absolute top-0 left-0 right-0 h-1 bg-white/15 overflow-hidden rounded-t-paper z-10"
              >
                <div
                  key={index}
                  className="autoplay-progress-bar h-full bg-secondary"
                  style={{
                    animationDuration: `${autoPlayIntervalMs}ms`,
                    // A negative delay seeks the animation forward by that
                    // much, so the bar picks up already caught up to the
                    // real timer instead of restarting at 0% on every mount.
                    animationDelay:
                      autoPlayStartedAt !== undefined
                        ? `-${Math.min(Date.now() - autoPlayStartedAt, autoPlayIntervalMs)}ms`
                        : undefined,
                  }}
                />
              </div>
            )}
            <img
              src={photo.url}
              alt={photo.filename || 'Photo'}
              className="max-w-full max-h-[75vh] object-contain rounded-paper"
            />
          </div>
          {photo.caption && (
            <p className="font-body italic text-white/80 text-center max-w-xl">
              &ldquo;{photo.caption}&rdquo;
            </p>
          )}
          {photos.length > 1 && (
            <span className="font-body italic text-white/60 text-sm">
              Photo {index + 1} of {photos.length}
            </span>
          )}
          {((onReact && photo.reactions) ||
            (onAddComment && onDeleteComment && photo.commentCount !== undefined)) && (
            <div className="flex items-center gap-3">
              {onReact && photo.reactions && (
                <ReactionControl
                  pageId={photo._id}
                  reactions={photo.reactions}
                  onReact={(type) => onReact(photo._id, type)}
                  isPending={isReactionPending}
                  variant="dark"
                  onReactorsModalOpenChange={setIsReactorsModalOpen}
                  // The comment composer is a plain textarea sitting right
                  // next to this control — without this, ReactionControl's
                  // global "r" / digit-key shortcuts would eat keystrokes
                  // typed into it (and "r" followed by a digit 1-6 would
                  // fire a real reaction mutation as a side effect of typing
                  // a comment).
                  isKeyboardShortcutsDisabled={isCommentsPanelOpen}
                  viewerUsername={viewerUsername}
                />
              )}
              {onAddComment && onDeleteComment && photo.commentCount !== undefined && (
                <CommentControl
                  pageId={photo._id}
                  commentCount={photo.commentCount}
                  comments={comments}
                  isLoading={isCommentsLoading}
                  isError={isCommentsError}
                  onOpenChange={handleCommentsOpenChange}
                  onAddComment={(text, parentCommentId) => onAddComment(photo._id, text, parentCommentId)}
                  pendingCommentTarget={pendingCommentTarget}
                  erroredCommentTarget={erroredCommentTarget}
                  onDeleteComment={(commentId) => onDeleteComment(photo._id, commentId)}
                  pendingDeleteCommentId={pendingDeleteCommentId}
                  onReactToComment={
                    onReactToComment
                      ? (commentId, type) => onReactToComment(photo._id, commentId, type)
                      : undefined
                  }
                  pendingReactionCommentId={pendingReactionCommentId}
                  variant="dark"
                  viewerId={viewerId}
                  viewerUsername={viewerUsername}
                  isAlbumOwner={isAlbumOwner}
                  hasMoreComments={hasMoreComments}
                  isFetchingMoreComments={isFetchingMoreComments}
                  hasFetchMoreCommentsError={hasFetchMoreCommentsError}
                  onFetchMoreComments={onFetchMoreComments}
                />
              )}
            </div>
          )}
        </div>

        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => navigate(hasNext ? index + 1 : 0)}
            disabled={isCommentsPanelOpen}
            aria-label={hasNext ? 'Next photo' : 'Back to first photo'}
            title={hasNext ? undefined : 'Back to first photo'}
            className="shrink-0 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors disabled:opacity-20 disabled:pointer-events-none"
          >
            <Icon name={hasNext ? 'chevron_right' : 'replay'} className="text-2xl" />
          </button>
        )}
      </div>
    </div>
  );
}
