import { describe, test, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import useClampedPage from './useClampedPage';

describe('useClampedPage', () => {
  test('clamps the page down when it lands past the new total', () => {
    const setPage = vi.fn();
    renderHook(() => useClampedPage(3, 2, setPage));
    expect(setPage).toHaveBeenCalledWith(2);
  });

  test('does nothing when the page is within range', () => {
    const setPage = vi.fn();
    renderHook(() => useClampedPage(1, 2, setPage));
    expect(setPage).not.toHaveBeenCalled();
  });

  test('does nothing while totalPages is still unknown (0)', () => {
    const setPage = vi.fn();
    renderHook(() => useClampedPage(1, 0, setPage));
    expect(setPage).not.toHaveBeenCalled();
  });
});
