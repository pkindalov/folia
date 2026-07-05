import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import { mockBook } from '../mock';

export default function ViewerPage() {
  useParams(); // book id — used once the flipbooks API exists
  const [pageIndex, setPageIndex] = useState(0);
  const [draft, setDraft] = useState('');
  const page = mockBook.pages[pageIndex];
  const isFirst = pageIndex === 0;
  const isLast = pageIndex === mockBook.pages.length - 1;

  return (
    <AppShell>
      <div className="p-gutter md:p-margin-edge">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-10 flex items-center justify-between">
            <div>
              <Link
                to="/flipbooks"
                className="font-ui text-ui-label uppercase text-on-surface-variant hover:text-secondary transition-colors flex items-center gap-2"
              >
                <Icon name="arrow_back" className="text-lg" />
                The Gallery
              </Link>
              <h2 className="font-display text-headline-md text-primary mt-2 italic">
                {mockBook.title}
              </h2>
            </div>
            <span className="font-body italic text-on-surface-variant text-sm">
              spread {pageIndex + 1} of {mockBook.pages.length}
            </span>
          </div>

          {/* The open book */}
          <div className="relative flex items-center gap-2 md:gap-6">
            <button
              onClick={() => setPageIndex((i) => i - 1)}
              disabled={isFirst}
              aria-label="Previous page"
              className="flex-shrink-0 w-12 h-12 rounded-full bg-surface-container-lowest border border-outline-variant/50 shadow-md flex items-center justify-center text-primary hover:border-secondary hover:text-secondary transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <Icon name="chevron_left" />
            </button>

            <div className="flex-1 grid md:grid-cols-2 bg-surface rounded-card paper-depth overflow-hidden border border-outline-variant/30 min-h-[520px]">
              {/* Left page: photo */}
              <div className="relative p-8 md:p-12 border-b md:border-b-0 md:border-r border-outline-variant/40">
                <div className="absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-black/10 to-transparent hidden md:block" />
                <div className="bg-white p-3 pb-4 stuck-photo rotate-[-0.5deg] max-w-sm mx-auto">
                  <img
                    key={page.photo}
                    className="w-full aspect-[4/5] object-cover"
                    alt={page.caption}
                    src={page.photo}
                  />
                </div>
                <p className="mt-8 max-w-sm mx-auto font-body italic text-body-text text-on-surface-variant text-center">
                  “{page.caption}”
                </p>
                <span className="absolute bottom-4 left-8 font-body italic text-xs text-on-surface-variant/60">
                  {pageIndex * 2 + 1}
                </span>
              </div>

              {/* Right page: reflections */}
              <div className="relative p-8 md:p-12 flex flex-col">
                <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/10 to-transparent hidden md:block" />
                <h3 className="font-display text-headline-md text-on-surface mb-2">Reflections</h3>
                <p className="font-body italic text-sm text-on-surface-variant mb-8">
                  Notes left in the margin by family and friends.
                </p>

                <ul className="flex-1 flex flex-col gap-6 overflow-y-auto">
                  {page.reflections.map((reflection, i) => (
                    <li key={i} className="border-b border-outline-variant/30 pb-4">
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="font-ui text-ui-label uppercase text-primary">
                          {reflection.author}
                        </span>
                        <span className="font-body italic text-xs text-on-surface-variant/70">
                          {reflection.when}
                        </span>
                      </div>
                      <p className="font-body text-on-surface-variant">{reflection.text}</p>
                    </li>
                  ))}
                </ul>

                <form
                  className="mt-8 flex gap-3 items-end"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setDraft('');
                  }}
                >
                  <div className="flex-1">
                    <label className="font-ui text-[12px] uppercase text-outline" htmlFor="reflection-input">
                      Leave a reflection
                    </label>
                    <input
                      id="reflection-input"
                      className="line-input w-full py-2"
                      placeholder="Write in the margin…"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    aria-label="Send reflection"
                    className="w-11 h-11 rounded-full bg-secondary text-on-secondary flex items-center justify-center shadow-md hover:opacity-90 active:scale-95 transition-all"
                  >
                    <Icon name="send" className="text-lg" />
                  </button>
                </form>
                <span className="absolute bottom-4 right-8 font-body italic text-xs text-on-surface-variant/60">
                  {pageIndex * 2 + 2}
                </span>
              </div>
            </div>

            <button
              onClick={() => setPageIndex((i) => i + 1)}
              disabled={isLast}
              aria-label="Next page"
              className="flex-shrink-0 w-12 h-12 rounded-full bg-surface-container-lowest border border-outline-variant/50 shadow-md flex items-center justify-center text-primary hover:border-secondary hover:text-secondary transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <Icon name="chevron_right" />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
