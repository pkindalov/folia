import { useEffect, useRef } from 'react';
import Icon from './Icon';
import ReactionControl from './ReactionControl';
import useFocusTrap from '../hooks/useFocusTrap';
import type { ReactionSummary, ReactionType } from '../features/flipbooks';

type LightboxPhoto = {
  _id: string;
  url: string;
  filename?: string;
  caption?: string;
  // Reactions are viewer-only (see ViewerPage) — absent when the lightbox is
  // opened from the editor's page-management view.
  reactions?: ReactionSummary;
};

type PhotoLightboxProps = {
  photos: LightboxPhoto[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onReact?: (pageId: string, type: ReactionType) => void;
  isReactionPending?: boolean;
  viewerUsername?: string;
  // When the album viewer's slideshow keeps running behind the zoomed-in
  // photo, these mirror AlbumSpread's own progress bar so the countdown to
  // the next photo stays visible here too.
  isAutoPlaying?: boolean;
  autoPlayIntervalMs?: number;
};

export default function PhotoLightbox({
  photos,
  index,
  onClose,
  onNavigate,
  onReact,
  isReactionPending = false,
  viewerUsername,
  isAutoPlaying = false,
  autoPlayIntervalMs,
}: PhotoLightboxProps) {
  const photo = photos[index];
  const hasPrevious = index > 0;
  const hasNext = index < photos.length - 1;
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, photo !== undefined);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && hasPrevious) onNavigate(index - 1);
      // On the last photo this wraps back to the first — mirrors the arrow
      // button below, which does the same instead of just going dead there.
      if (event.key === 'ArrowRight' && photos.length > 1) onNavigate(hasNext ? index + 1 : 0);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [index, hasPrevious, hasNext, photos.length, onClose, onNavigate]);

  if (!photo) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-100 bg-black/90 flex flex-col items-center justify-center p-6"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo viewer"
        className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
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
            onClick={() => onNavigate(index - 1)}
            disabled={!hasPrevious}
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
                  style={{ animationDuration: `${autoPlayIntervalMs}ms` }}
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
          {onReact && photo.reactions && (
            <ReactionControl
              pageId={photo._id}
              reactions={photo.reactions}
              onReact={(type) => onReact(photo._id, type)}
              isPending={isReactionPending}
              variant="dark"
              viewerUsername={viewerUsername}
            />
          )}
        </div>

        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => onNavigate(hasNext ? index + 1 : 0)}
            aria-label={hasNext ? 'Next photo' : 'Back to first photo'}
            title={hasNext ? undefined : 'Back to first photo'}
            className="shrink-0 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <Icon name={hasNext ? 'chevron_right' : 'replay'} className="text-2xl" />
          </button>
        )}
      </div>
    </div>
  );
}
