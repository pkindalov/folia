import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../../components/Icon';
import ReactionControl from '../../../components/ReactionControl';
import KeyboardShortcutsHint from '../../../components/KeyboardShortcutsHint';
import type { Album, Page, ReactionType } from '../../flipbooks';

type AlbumSpreadProps = {
  album: Album;
  pages: Page[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  onOpenLightbox: () => void;
  onReact: (pageId: string, type: ReactionType) => void;
  isReactionPending: boolean;
  // The lightbox has its own arrow-key navigation while it's open — this
  // stays true then so the two don't both react to the same keystroke.
  isKeyboardNavDisabled?: boolean;
  viewerUsername?: string;
};

type FlipState = {
  direction: 'next' | 'prev';
  photoUrl: string;
};

// Long enough to read as a page turning rather than a flicker, short enough
// not to make navigation feel sluggish. Passed to the leaf's animation-duration
// inline so the CSS keyframes and the JS cleanup timer can never drift apart.
const FLIP_DURATION_MS = 550;

const FlipLeaf = ({ direction, photoUrl }: FlipState) => (
  <div
    aria-hidden="true"
    className={`hidden md:block absolute inset-y-0 w-1/2 pointer-events-none z-10 ${
      direction === 'next' ? 'right-0' : 'left-0'
    }`}
    style={{ perspective: '1800px' }}
  >
    <div
      className={direction === 'next' ? 'flip-leaf flip-leaf-forward' : 'flip-leaf flip-leaf-backward'}
      style={{ animationDuration: `${FLIP_DURATION_MS}ms` }}
    >
      <div className="flip-leaf-face flex items-center justify-center p-8 md:p-12">
        <div className="bg-white p-3.5 stuck-photo max-w-sm w-full">
          <img src={photoUrl} alt="" className="w-full aspect-square object-cover" />
        </div>
      </div>
      <div className="flip-leaf-face flip-leaf-face-back flex items-center justify-center p-8 md:p-12">
        <div className="bg-white p-3.5 stuck-photo max-w-sm w-full">
          <img src={photoUrl} alt="" className="w-full aspect-square object-cover" />
        </div>
      </div>
    </div>
  </div>
);

export default function AlbumSpread({
  album,
  pages,
  currentIndex,
  onNavigate,
  onOpenLightbox,
  onReact,
  isReactionPending,
  isKeyboardNavDisabled = false,
  viewerUsername,
}: AlbumSpreadProps) {
  const hasPhotos = pages.length > 0;
  const currentPhoto = pages[currentIndex];
  const previousPhoto = currentIndex > 0 ? pages[currentIndex - 1] : undefined;
  const hasNextPhoto = hasPhotos && currentIndex < pages.length - 1;
  const [isShortcutsHintOpen, setIsShortcutsHintOpen] = useState(false);

  const [flip, setFlip] = useState<FlipState | null>(null);
  const [flipSeq, setFlipSeq] = useState(0);
  const flipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
  }, []);

  const triggerFlip = (direction: 'next' | 'prev', outgoingPhoto: Page) => {
    if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    setFlip({ direction, photoUrl: outgoingPhoto.url });
    setFlipSeq((sequence) => sequence + 1);
    flipTimeoutRef.current = setTimeout(() => setFlip(null), FLIP_DURATION_MS);
  };

  const goToNext = useCallback(() => {
    if (!hasNextPhoto) return;
    triggerFlip('next', currentPhoto);
    onNavigate(currentIndex + 1);
  }, [hasNextPhoto, currentPhoto, currentIndex, onNavigate]);
  const goToPrevious = useCallback(() => {
    if (!previousPhoto) return;
    triggerFlip('prev', previousPhoto);
    onNavigate(currentIndex - 1);
  }, [previousPhoto, currentIndex, onNavigate]);

  useEffect(() => {
    if (isKeyboardNavDisabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') goToPrevious();
      if (event.key === 'ArrowRight') goToNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isKeyboardNavDisabled, goToPrevious, goToNext]);

  return (
    <div className="relative">
      <div className="grid md:grid-cols-2 bg-surface rounded-card paper-depth overflow-hidden border border-outline-variant/30 min-h-130">
        {/* Left page: the cover, or whichever photo was just turned past */}
        <div className="relative p-8 md:p-12 border-b md:border-b-0 md:border-r border-outline-variant/40 flex items-center justify-center">
          <div className="absolute inset-y-0 right-0 w-3 bg-linear-to-l from-black/10 to-transparent hidden md:block" />
          {previousPhoto ? (
            <button
              type="button"
              onClick={goToPrevious}
              aria-label={`Go back to ${previousPhoto.filename || 'previous photo'}`}
              className="group relative page-curl-hover bg-white p-3 pb-4 stuck-photo max-w-sm w-full cursor-pointer"
            >
              <img
                src={previousPhoto.url}
                alt={previousPhoto.filename}
                className="w-full aspect-square object-cover opacity-85 group-hover:opacity-100 transition-opacity"
              />
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Icon name="chevron_left" className="text-3xl text-white drop-shadow-lg" />
              </span>
            </button>
          ) : (
            <div className="text-center max-w-xs">
              <h3 className="font-display text-2xl text-primary italic">{album.title}</h3>
              {album.description && (
                <p className="font-body italic text-on-surface-variant mt-4">{album.description}</p>
              )}
            </div>
          )}
        </div>

        {/* Right page: the current photo */}
        <div className="relative p-8 md:p-12 flex items-center justify-center">
          <div className="absolute inset-y-0 left-0 w-3 bg-linear-to-r from-black/10 to-transparent hidden md:block" />
          {hasPhotos ? (
            <div className="bg-white p-3.5 stuck-photo max-w-sm w-full">
              <div className="relative">
                <button
                  type="button"
                  onClick={onOpenLightbox}
                  aria-label={`View ${currentPhoto.filename || 'this photo'} full size`}
                  className="block w-full cursor-zoom-in"
                >
                  <img
                    key={currentPhoto._id}
                    src={currentPhoto.url}
                    alt={currentPhoto.filename}
                    className="w-full aspect-square object-cover"
                  />
                </button>
                {pages.length > 1 && (
                  <>
                    <button
                      onClick={goToPrevious}
                      disabled={currentIndex === 0}
                      aria-label="Previous photo"
                      className="absolute top-1/2 left-2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 shadow-md flex items-center justify-center text-on-surface hover:bg-white transition-colors focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 disabled:opacity-0 disabled:pointer-events-none"
                    >
                      <Icon name="chevron_left" />
                    </button>
                    <button
                      onClick={goToNext}
                      disabled={currentIndex === pages.length - 1}
                      aria-label="Next photo"
                      className="absolute top-1/2 right-2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 shadow-md flex items-center justify-center text-on-surface hover:bg-white transition-colors focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 disabled:opacity-0 disabled:pointer-events-none"
                    >
                      <Icon name="chevron_right" />
                    </button>
                  </>
                )}
              </div>

              {currentPhoto.caption && (
                <p className="pt-3 font-body italic text-on-surface-variant text-center text-sm">
                  "{currentPhoto.caption}"
                </p>
              )}

              <div className="photo-tear mt-3" aria-hidden="true" />

              <div className="flex items-center justify-between py-2">
                <ReactionControl
                  pageId={currentPhoto._id}
                  reactions={currentPhoto.reactions}
                  onReact={(type) => onReact(currentPhoto._id, type)}
                  isPending={isReactionPending}
                  variant="light"
                  isKeyboardShortcutsDisabled={isKeyboardNavDisabled || isShortcutsHintOpen}
                  viewerUsername={viewerUsername}
                />
                <div className="flex items-center gap-2">
                  {pages.length > 1 && (
                    <span className="font-body italic text-on-surface-variant text-xs">
                      Photo {currentIndex + 1} of {pages.length}
                    </span>
                  )}
                  {!isKeyboardNavDisabled && <KeyboardShortcutsHint onOpenChange={setIsShortcutsHintOpen} />}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center flex flex-col items-center gap-4 text-on-surface-variant">
              <Icon name="auto_stories" className="text-5xl" />
              <p className="font-body italic">This volume has no pages yet.</p>
              <Link
                to={`/editor/${album._id}`}
                className="font-ui text-ui-label uppercase text-secondary hover:underline flex items-center gap-2"
              >
                <Icon name="edit" className="text-base" />
                Add memories in the editor
              </Link>
            </div>
          )}
        </div>
      </div>

      {flip && <FlipLeaf key={flipSeq} direction={flip.direction} photoUrl={flip.photoUrl} />}
    </div>
  );
}
