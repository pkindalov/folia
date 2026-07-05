import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import { mockFlipbooks, VISIBILITY_ICON, type Flipbook } from '../mock';

const FILTERS = ['All Volumes', 'Public', 'Shared', 'Private'] as const;
type Filter = (typeof FILTERS)[number];

function matchesFilter(book: Flipbook, filter: Filter) {
  if (filter === 'All Volumes') return true;
  return book.visibility === filter.toLowerCase();
}

export default function MyFlipbooksPage() {
  const [filter, setFilter] = useState<Filter>('All Volumes');
  const navigate = useNavigate();
  const books = mockFlipbooks.filter((b) => matchesFilter(b, filter));

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
                  onClick={() => setFilter(f)}
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

          {/* Albums grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-16">
            {/* Create new volume */}
            <button
              onClick={() => navigate('/editor')}
              className="group flex flex-col items-center text-left h-[340px]"
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

            {/* Albums */}
            {books.map((book) => (
              <Link
                key={book._id}
                to={`/book/${book._id}`}
                className="group flex flex-col items-center h-[340px] cursor-pointer"
              >
                <div
                  className="relative w-full flex-1 rounded-r-card shadow-[0_8px_30px_rgba(0,0,0,0.15)] overflow-hidden transition-transform duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.2)]"
                  style={{ backgroundColor: book.coverColor }}
                >
                  {book.coverImage && (
                    <img
                      src={book.coverImage}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-luminosity"
                    />
                  )}
                  <div className="absolute inset-0 flex flex-col justify-between p-6">
                    <span className="self-end text-white/80">
                      <Icon name={VISIBILITY_ICON[book.visibility]} className="text-lg" />
                    </span>
                    <div>
                      <h3 className="font-display text-2xl text-white leading-tight">{book.title}</h3>
                      <p className="font-body italic text-white/70 text-sm mt-1">{book.subtitle}</p>
                    </div>
                  </div>
                  {/* Spine crease */}
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-white/20" />
                  <div className="absolute left-5 top-0 bottom-0 w-px bg-black/20" />
                </div>
                <div className="mt-6 w-full px-2 flex justify-between items-baseline">
                  <span className="font-ui text-ui-label uppercase text-on-surface-variant">
                    {book.pageCount} pages
                  </span>
                  <span className="font-body italic text-sm text-on-surface-variant capitalize">
                    {book.visibility}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
