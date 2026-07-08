import { useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import Pagination from '../../../components/Pagination';
import useClampedPage from '../../../hooks/useClampedPage';
import { useArchivedAlbums, useArchiveAlbum, coverColor, type Album } from '../../flipbooks';

const VISIBILITY_ICON: Record<Album['visibility'], string> = {
  private: 'lock',
  public: 'public',
  shared: 'group',
};

function ArchivedVolumeCard({ album }: { album: Album }) {
  const restoreAlbum = useArchiveAlbum(album._id);

  return (
    <div className="group flex flex-col items-center h-85">
      <Link
        to={`/book/${album._id}`}
        className="relative w-full flex-1 rounded-r-card shadow-[0_8px_30px_rgba(0,0,0,0.15)] overflow-hidden transition-transform duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.2)] block"
        style={{ backgroundColor: coverColor(album._id) }}
      >
        {album.coverImage && (
          <>
            <img
              src={album.coverImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover grayscale-40"
            />
            <div className="absolute inset-0 bg-black/40" />
          </>
        )}
        <div className="absolute inset-0 flex flex-col justify-between p-6">
          <span className="self-end text-white/80">
            <Icon name={VISIBILITY_ICON[album.visibility]} className="text-lg" />
          </span>
          <div>
            <h3 className="font-display text-2xl text-white leading-tight">{album.title}</h3>
            {album.description && (
              <p className="font-body italic text-white/70 text-sm mt-1 line-clamp-2">
                {album.description}
              </p>
            )}
          </div>
        </div>
        <div className="absolute left-4 top-0 bottom-0 w-px bg-white/20" />
        <div className="absolute left-5 top-0 bottom-0 w-px bg-black/20" />
      </Link>
      <div className="mt-6 w-full px-2 flex justify-between items-center">
        <span className="font-ui text-ui-label uppercase text-on-surface-variant">
          {album.pageCount} pages
        </span>
        <button
          onClick={() => restoreAlbum.mutate(false)}
          disabled={restoreAlbum.isPending}
          aria-label={`Restore ${album.title}`}
          className="flex items-center gap-1 font-ui text-ui-label uppercase text-on-surface-variant hover:text-secondary transition-colors disabled:opacity-50"
        >
          <Icon name="unarchive" className="text-base" />
          {restoreAlbum.isPending ? 'Restoring…' : 'Restore'}
        </button>
      </div>
      {restoreAlbum.isError && (
        <p role="alert" className="mt-2 w-full px-2 text-sm text-error font-ui">
          {restoreAlbum.error.message}
        </p>
      )}
    </div>
  );
}

export default function ArchivePage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useArchivedAlbums(page);
  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  // Restoring the last album on a later page can leave `page` pointing past
  // the new last page — fall back to it rather than showing a blank page.
  useClampedPage(page, totalPages, setPage);

  return (
    <AppShell>
      <div className="p-gutter md:p-margin-edge">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 border-b border-outline-variant pb-6">
            <h2 className="font-display text-display-lg text-primary mb-2">The Grand Archive</h2>
            <p className="font-body text-body-text text-on-surface-variant max-w-2xl">
              Completed volumes, sealed and preserved. Restore one to bring it back to your
              gallery.
            </p>
          </div>

          {isLoading && (
            <p className="font-body italic text-on-surface-variant">Opening the archive…</p>
          )}
          {isError && (
            <p className="px-4 py-3 bg-error-container text-on-error-container rounded-paper font-ui text-sm inline-block">
              {error.message}
            </p>
          )}

          {data && data.total === 0 && (
            <div className="flex flex-col items-center gap-4 py-24 text-center text-on-surface-variant">
              <Icon name="inventory_2" className="text-5xl" />
              <p className="font-body italic text-body-text">Nothing has been archived yet.</p>
            </div>
          )}

          {data && data.total > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-16">
              {data.albums.map((album) => (
                <ArchivedVolumeCard key={album._id} album={album} />
              ))}
            </div>
          )}

          {data && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
        </div>
      </div>
    </AppShell>
  );
}
