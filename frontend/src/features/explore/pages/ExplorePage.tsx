import { useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import Pagination from '../../../components/Pagination';
import { usePublicAlbums, coverColor } from '../../flipbooks';

export default function ExplorePage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = usePublicAlbums(page);
  const albums = data?.albums;
  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <AppShell>
      <div className="p-gutter md:p-margin-edge">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 border-b border-outline-variant pb-6">
            <h2 className="font-display text-display-lg text-primary mb-2">The Community Table</h2>
            <p className="font-body text-body-text text-on-surface-variant max-w-2xl">
              Volumes shared publicly by other archivists, laid out for browsing.
            </p>
          </div>

          {isLoading && (
            <p className="font-body italic text-on-surface-variant">Setting the table…</p>
          )}
          {isError && (
            <p className="px-4 py-3 bg-error-container text-on-error-container rounded-paper font-ui text-sm inline-block">
              {error.message}
            </p>
          )}

          {albums && albums.length === 0 && (
            <p className="font-body italic text-on-surface-variant text-body-text">
              There are no public volumes yet. When someone shares an album with the community, it
              will appear here.
            </p>
          )}

          {albums && albums.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-16">
              {albums.map((album, i) => (
                <div key={album._id} className="flex flex-col">
                  <Link
                    to={`/book/${album._id}`}
                    className={`group relative block aspect-4/5 rounded-r-card overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-transform duration-500 hover:-translate-y-2 ${
                      i % 3 === 1 ? 'rotate-[0.6deg]' : i % 3 === 2 ? 'rotate-[-0.8deg]' : ''
                    }`}
                    style={{ backgroundColor: coverColor(album._id) }}
                  >
                    {album.coverImage && (
                      <img
                        src={album.coverImage}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute bottom-0 p-6">
                      <h3 className="font-display text-[28px] leading-tight text-surface font-semibold">
                        {album.title}
                      </h3>
                      <p className="font-body italic text-surface/80 text-sm mt-1">
                        by {album.ownerUsername}
                      </p>
                    </div>
                    <div className="absolute left-3 top-0 bottom-0 w-px bg-white/20" />
                  </Link>
                  <div className="mt-4 px-1 font-ui text-ui-label uppercase text-on-surface-variant">
                    {album.pageCount} pages
                  </div>
                </div>
              ))}
            </div>
          )}

          {albums && albums.length > 0 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </div>
      </div>
    </AppShell>
  );
}
