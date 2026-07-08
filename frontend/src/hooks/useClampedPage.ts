import { useEffect } from 'react';

// If the current page goes out of range after a mutation (e.g. deleting the
// last item on the last page), fall back to the new last page rather than
// showing a blank list with no way back.
export default function useClampedPage(page: number, totalPages: number, setPage: (page: number) => void) {
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [page, totalPages, setPage]);
}
