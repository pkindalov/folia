import { describe, test, expect, vi } from 'vitest';
import { renderHook, fireEvent } from '@testing-library/react';
import useEscapeKey from './useEscapeKey';

describe('useEscapeKey', () => {
  test('calls onEscape when Escape is pressed while active', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(true, onEscape));

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  test('does nothing when inactive', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(false, onEscape));

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(onEscape).not.toHaveBeenCalled();
  });

  test('ignores keys other than Escape', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(true, onEscape));

    fireEvent.keyDown(document.body, { key: 'Enter' });

    expect(onEscape).not.toHaveBeenCalled();
  });

  test('stops the Escape keypress from reaching an ancestor listener (e.g. PhotoLightbox)', () => {
    const onEscape = vi.fn();
    const ancestorListener = vi.fn();
    window.addEventListener('keydown', ancestorListener);

    renderHook(() => useEscapeKey(true, onEscape));
    fireEvent.keyDown(document.body, { key: 'Escape' });

    window.removeEventListener('keydown', ancestorListener);

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(ancestorListener).not.toHaveBeenCalled();
  });
});
