import { useCallback, useEffect, useState } from 'react';
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

  const [isReactorsModalOpen, setIsReactorsModalOpen] = useState(false);

  // Owned here (not inside AlbumSpread) so the header's play/pause button and
  // the spread's own auto-advance timer always agree on state. AlbumSpread
  // is still the one actually running the timer and flipping pages — it
  // calls this back to false the moment the viewer stops being a passive
  // slideshow (manual navigation, the lightbox opening, the tab going
  // background).
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

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
  // editor's own PagesPanel, which unmounts its lightbox the same way.
  useEffect(() => {
    if (isLightboxOpen && selectedIndex === -1) setIsLightboxOpen(false);
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
              viewerUsername={me?.username}
              isAutoPlaying={isAutoPlaying}
              onAutoPlayingChange={setIsAutoPlaying}
              onAutoPlayEnd={endAutoPlay}
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
          viewerUsername={me?.username}
          isAutoPlaying={isAutoPlaying}
          autoPlayIntervalMs={AUTOPLAY_INTERVAL_MS}
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
