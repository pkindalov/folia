import { useEffect, type RefObject } from 'react';

// Closes a panel-like UI (dropdown, popover) when a pointer interaction lands
// outside every one of the given elements — pass the panel itself plus its
// trigger button so clicking the trigger again is handled by the trigger's
// own toggle instead of being treated as an "outside" click.
export default function useOutsideClick(
  refs: RefObject<HTMLElement | null>[],
  onOutsideClick: () => void,
  isActive: boolean
) {
  useEffect(() => {
    if (!isActive) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      const clickedInsideTrackedElement = refs.some(
        (ref) => ref.current !== null && ref.current.contains(target)
      );
      if (!clickedInsideTrackedElement) onOutsideClick();
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isActive, refs, onOutsideClick]);
}
