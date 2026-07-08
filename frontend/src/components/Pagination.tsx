import Icon from './Icon';

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

type PageItem = number | 'ellipsis';

// Builds the sequence of page buttons/ellipses to render. Without this, a
// list with hundreds of pages would render hundreds of buttons — instead
// this always keeps the first page, the last page, and the current page
// with one neighbor on each side, collapsing any gap into an ellipsis.
function buildPageItems(page: number, totalPages: number): PageItem[] {
  const keptPages = [...new Set([1, totalPages, page - 1, page, page + 1])]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const items: PageItem[] = [];
  keptPages.forEach((p, i) => {
    const previous = keptPages[i - 1];
    if (previous !== undefined && p - previous > 1) items.push('ellipsis');
    items.push(p);
  });
  return items;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pageItems = buildPageItems(page, totalPages);

  return (
    <nav aria-label="Pagination" className="mt-16 flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className="w-10 h-10 rounded-full border border-outline-variant/50 flex items-center justify-center text-on-surface-variant hover:border-secondary hover:text-secondary transition-colors disabled:opacity-30 disabled:pointer-events-none"
      >
        <Icon name="chevron_left" />
      </button>

      {pageItems.map((item, index) =>
        item === 'ellipsis' ? (
          <span
            key={`ellipsis-${index}`}
            aria-hidden="true"
            className="w-10 h-10 flex items-center justify-center text-on-surface-variant"
          >
            &hellip;
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-label={`Page ${item}`}
            aria-current={item === page ? 'page' : undefined}
            className={`w-10 h-10 rounded-full font-ui text-ui-label flex items-center justify-center transition-colors ${
              item === page
                ? 'bg-secondary text-on-secondary'
                : 'text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            {item}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
        className="w-10 h-10 rounded-full border border-outline-variant/50 flex items-center justify-center text-on-surface-variant hover:border-secondary hover:text-secondary transition-colors disabled:opacity-30 disabled:pointer-events-none"
      >
        <Icon name="chevron_right" />
      </button>
    </nav>
  );
}
