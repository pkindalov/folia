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
};

export default function PhotoLightbox({
  photos,
  index,
  onClose,
  onNavigate,
  onReact,
  isReactionPending = false,
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
      if (event.key === 'ArrowRight' && hasNext) onNavigate(index + 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [index, hasPrevious, hasNext, onClose, onNavigate]);

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
          <img
            src={photo.url}
            alt={photo.filename || 'Photo'}
            className="max-w-full max-h-[75vh] object-contain rounded-paper"
          />
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
              reactions={photo.reactions}
              onReact={(type) => onReact(photo._id, type)}
              isPending={isReactionPending}
              variant="dark"
            />
          )}
        </div>

        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => onNavigate(index + 1)}
            disabled={!hasNext}
            aria-label="Next photo"
            className="shrink-0 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors disabled:opacity-20 disabled:pointer-events-none"
          >
            <Icon name="chevron_right" className="text-2xl" />
          </button>
        )}
      </div>
    </div>
  );
}
