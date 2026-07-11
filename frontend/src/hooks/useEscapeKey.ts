import { useEffect } from 'react';

// Calls onEscape while active and the Escape key is pressed — shared by any
// dismissible overlay (modal, dropdown panel).
export default function useEscapeKey(isActive: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!isActive) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // Stops the keypress from reaching an ancestor's own Escape listener
      // (e.g. PhotoLightbox's window-level handler) — otherwise dismissing a
      // nested overlay like a modal or dropdown also closes whatever it's
      // layered on top of.
      if (event.key === 'Escape') {
        event.stopPropagation();
        onEscape();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isActive, onEscape]);
}
