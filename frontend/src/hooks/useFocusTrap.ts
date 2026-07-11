import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

// Standard modal-dialog focus behavior: while active, keeps Tab/Shift+Tab
// cycling within the container instead of leaking out to the page behind
// it, moves focus in on activation, and restores it to whatever had focus
// before once deactivated.
export default function useFocusTrap(containerRef: RefObject<HTMLElement | null>, isActive: boolean) {
  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
    const [firstFocusable] = getFocusable(container);
    (firstFocusable ?? container).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      // Nothing inside to trap Tab between (e.g. a read-only list with no
      // interactive rows) — previously this called preventDefault() here,
      // which pinned focus on the container with no keyboard way out.
      // Letting Tab fall through to its default behavior instead moves
      // focus off the container and out of the trap, same as if the trap
      // were not applied at all.
      const focusable = getFocusable(container);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [isActive, containerRef]);
}
