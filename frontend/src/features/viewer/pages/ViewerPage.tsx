import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import { useAlbum, usePages } from '../../flipbooks';

export default function ViewerPage() {
  const { id } = useParams();
  const { data: album, isLoading, isError, error } = useAlbum(id);
  const { data: pagesData } = usePages(id);
  const pages = pagesData ?? [];
  const hasPhotos = pages.length > 0;

  const [photoIndex, setPhotoIndex] = useState(0);
  useEffect(() => setPhotoIndex(0), [id]);
  const currentIndex = Math.min(photoIndex, pages.length - 1);
  const currentPhoto = pages[currentIndex];

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
                    <div className="bg-white p-3 pb-4 stuck-photo max-w-sm w-full">
                      <img
                        key={currentPhoto._id}
                        src={currentPhoto.url}
                        alt={currentPhoto.filename}
                        className="w-full aspect-square object-cover"
                      />
                    </div>
                    {pages.length > 1 && (
                      <div className="flex items-center gap-6">
                        <button
                          onClick={() => setPhotoIndex((i) => i - 1)}
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
                          onClick={() => setPhotoIndex((i) => i + 1)}
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
    </AppShell>
  );
}
