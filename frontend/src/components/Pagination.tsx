import Icon from './Icon';

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

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

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
        <button
          key={pageNumber}
          type="button"
          onClick={() => onPageChange(pageNumber)}
          aria-label={`Page ${pageNumber}`}
          aria-current={pageNumber === page ? 'page' : undefined}
          className={`w-10 h-10 rounded-full font-ui text-ui-label flex items-center justify-center transition-colors ${
            pageNumber === page
              ? 'bg-secondary text-on-secondary'
              : 'text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          {pageNumber}
        </button>
      ))}

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
