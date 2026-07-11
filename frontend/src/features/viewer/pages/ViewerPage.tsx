import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import PhotoLightbox from '../../../components/PhotoLightbox';
import ReactionControl from '../../../components/ReactionControl';
import AlbumLoveButton from '../../../components/AlbumLoveButton';
import AlbumReactorsModal from '../../../components/AlbumReactorsModal';
import { toast } from '../../../lib/toast';
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

  const [isReactorsModalOpen, setIsReactorsModalOpen] = useState(false);

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const openLightbox = () => {
    // Pin the lightbox to this specific photo (not just "whatever index 0
    // currently is") so the effect below can tell a real removal apart from
    // an ordinary refetch that leaves the same photo in place.
    setPhotoId(currentPhoto._id);
    setIsLightboxOpen(true);
  };
  // If the photo the lightbox is showing disappears from the list while it's
  // open (e.g. deleted from another tab), close it instead of silently
  // falling back to whatever photo now occupies index 0 — mirrors the
  // editor's own PagesPanel, which unmounts its lightbox the same way.
  useEffect(() => {
    if (isLightboxOpen && selectedIndex === -1) setIsLightboxOpen(false);
  }, [isLightboxOpen, selectedIndex]);

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
            <div className="grid md:grid-cols-2 bg-surface rounded-card paper-depth overflow-hidden border border-outline-variant/30 min-h-130">
              {/* Left page: cover */}
              <div className="relative p-8 md:p-12 border-b md:border-b-0 md:border-r border-outline-variant/40 flex items-center justify-center">
                <div className="absolute inset-y-0 right-0 w-3 bg-linear-to-l from-black/10 to-transparent hidden md:block" />
                <div className="text-center max-w-xs">
                  <h3 className="font-display text-2xl text-primary italic">{album.title}</h3>
                  {album.description && (
                    <p className="font-body italic text-on-surface-variant mt-4">
                      {album.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Right page: the volume's photos */}
              <div className="relative p-8 md:p-12 flex items-center justify-center">
                <div className="absolute inset-y-0 left-0 w-3 bg-linear-to-r from-black/10 to-transparent hidden md:block" />
                {hasPhotos ? (
                  <div className="flex flex-col items-center gap-6 w-full">
                    <button
                      type="button"
                      onClick={openLightbox}
                      aria-label={`View ${currentPhoto.filename || 'this photo'} full size`}
                      className="bg-white p-3 pb-4 stuck-photo max-w-sm w-full cursor-zoom-in"
                    >
                      <img
                        key={currentPhoto._id}
                        src={currentPhoto.url}
                        alt={currentPhoto.filename}
                        className="w-full aspect-square object-cover"
                      />
                    </button>
                    {currentPhoto.caption && (
                      <p className="max-w-sm mx-auto font-body italic text-on-surface-variant text-center">
                        "{currentPhoto.caption}"
                      </p>
                    )}
                    <ReactionControl
                      pageId={currentPhoto._id}
                      reactions={currentPhoto.reactions}
                      onReact={(type) => handleReact(currentPhoto._id, type)}
                      isPending={setReaction.isPending}
                      variant="light"
                    />
                    {pages.length > 1 && (
                      <div className="flex items-center gap-6">
                        <button
                          onClick={() => setPhotoId(pages[currentIndex - 1]._id)}
                          disabled={currentIndex === 0}
                          aria-label="Previous photo"
                          className="shrink-0 w-10 h-10 rounded-full bg-surface-container-lowest border border-outline-variant/50 shadow-md flex items-center justify-center text-primary hover:border-secondary hover:text-secondary transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <Icon name="chevron_left" />
                        </button>
                        <span className="font-body italic text-on-surface-variant text-sm">
                          Photo {currentIndex + 1} of {pages.length}
                        </span>
                        <button
                          onClick={() => setPhotoId(pages[currentIndex + 1]._id)}
                          disabled={currentIndex === pages.length - 1}
                          aria-label="Next photo"
                          className="shrink-0 w-10 h-10 rounded-full bg-surface-container-lowest border border-outline-variant/50 shadow-md flex items-center justify-center text-primary hover:border-secondary hover:text-secondary transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <Icon name="chevron_right" />
                        </button>
                      </div>
                    )}
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
          )}
        </div>
      </div>

      {isLightboxOpen && hasPhotos && (
        <PhotoLightbox
          photos={pages}
          index={currentIndex}
          onClose={() => setIsLightboxOpen(false)}
          onNavigate={(nextIndex) => setPhotoId(pages[nextIndex]?._id ?? null)}
          onReact={handleReact}
          isReactionPending={setReaction.isPending}
        />
      )}

      {album && (
        <AlbumReactorsModal
          isOpen={isReactorsModalOpen}
          onClose={() => setIsReactorsModalOpen(false)}
          reactors={album.reactions.reactors}
        />
      )}
    </AppShell>
  );
}
