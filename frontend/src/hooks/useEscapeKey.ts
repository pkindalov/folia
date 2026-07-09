import { useEffect } from 'react';

// Calls onEscape while active and the Escape key is pressed — shared by any
// dismissible overlay (modal, dropdown panel).
export default function useEscapeKey(isActive: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!isActive) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscape();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isActive, onEscape]);
}
