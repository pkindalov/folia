import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import Pagination from '../../../components/Pagination';
import useClampedPage from '../../../hooks/useClampedPage';
import { useAlbums, coverColor } from '../hooks';
import type { Album } from '../schemas';

const FILTERS = ['All Volumes', 'Public', 'Shared', 'Private'] as const;
type Filter = (typeof FILTERS)[number];

const VISIBILITY_ICON: Record<Album['visibility'], string> = {
  private: 'lock',
  public: 'public',
  shared: 'group',
};

function visibilityForFilter(filter: Filter): Album['visibility'] | undefined {
  if (filter === 'All Volumes') return undefined;
  return filter.toLowerCase() as Album['visibility'];
}

export default function MyFlipbooksPage() {
  const [filter, setFilter] = useState<Filter>('All Volumes');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useAlbums(page, visibilityForFilter(filter));
  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  const onFilterChange = (nextFilter: Filter) => {
    setFilter(nextFilter);
    setPage(1);
  };

  // Deleting/archiving the last album on a later page can leave `page`
  // pointing past the new last page — fall back to it rather than showing a
  // blank grid with no way back.
  useClampedPage(page, totalPages, setPage);

  return (
    <AppShell>
      <div className="p-gutter md:p-margin-edge">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end border-b border-outline-variant pb-6">
            <div>
              <h2 className="font-display text-display-lg text-primary mb-2">The Gallery</h2>
              <p className="font-body text-body-text text-on-surface-variant max-w-2xl">
                A curated collection of your shared histories, bound in digital cloth and leather.
                Select a volume to continue the narrative.
              </p>
            </div>
            <div className="mt-6 md:mt-0 flex gap-4">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => onFilterChange(f)}
                  className={`font-ui text-ui-label uppercase pb-1 transition-colors ${
                    filter === f
                      ? 'text-primary border-b border-primary'
                      : 'text-on-surface-variant hover:text-primary'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {isLoading && (
            <p className="font-body italic text-on-surface-variant">Opening the cabinet…</p>
          )}
          {isError && (
            <p className="px-4 py-3 bg-error-container text-on-error-container rounded-paper font-ui text-sm inline-block">
              {error.message}
            </p>
          )}

          {data && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-16">
              {/* Create new volume */}
              {page === 1 && (
                <button
                  onClick={() => navigate('/editor')}
                  className="group flex flex-col items-center text-left h-85"
                >
                  <div className="relative w-full flex-1 bg-surface-container-high rounded-r-card shadow-[0_8px_30px_rgba(0,0,0,0.08)] flex items-center justify-center border-l border-outline-variant transition-transform duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-outline text-outline flex items-center justify-center bg-surface-container-lowest">
                      <Icon name="add" className="text-3xl" />
                    </div>
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-outline-variant opacity-30" />
                    <div className="absolute left-5 top-0 bottom-0 w-px bg-surface-container-lowest opacity-50" />
                  </div>
                  <div className="mt-6 w-full px-2">
                    <h3 className="font-display text-primary text-xl">Start a New Volume</h3>
                    <p className="font-body italic text-on-surface-variant mt-1">
                      Empty canvas, ready for memories
                    </p>
                  </div>
                </button>
              )}

              {/* Albums */}
              {data.albums.map((album) => (
                <div key={album._id} className="group flex flex-col items-center h-85">
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
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30" />
                      </>
                    )}
                    <div className="absolute inset-0 flex flex-col justify-between p-6">
                      <span className="self-end text-white/80">
                        <Icon name={VISIBILITY_ICON[album.visibility]} className="text-lg" />
                      </span>
                      <div>
                        <h3 className="font-display text-2xl text-white leading-tight">
                          {album.title}
                        </h3>
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
                      {album.pageCount} pages · {album.visibility}
                    </span>
                    <button
                      onClick={() => navigate(`/editor/${album._id}`)}
                      aria-label={`Edit ${album.title}`}
                      className="flex items-center gap-1 font-ui text-ui-label uppercase text-on-surface-variant hover:text-secondary transition-colors"
                    >
                      <Icon name="edit" className="text-base" />
                      Edit
                    </button>
                  </div>
                </div>
              ))}

              {data.total === 0 && (
                <div className="col-span-full sm:col-span-1 lg:col-span-2 flex items-center">
                  <p className="font-body italic text-on-surface-variant text-body-text">
                    {filter === 'All Volumes'
                      ? 'Your shelf is empty. Start your first volume and give your memories a home.'
                      : `No ${filter.toLowerCase()} volumes yet.`}
                  </p>
                </div>
              )}
            </div>
          )}

          {data && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
        </div>
      </div>
    </AppShell>
  );
}
