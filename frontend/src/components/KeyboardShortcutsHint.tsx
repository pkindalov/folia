import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import useFocusTrap from '../hooks/useFocusTrap';
import useOutsideClick from '../hooks/useOutsideClick';
import useEscapeKey from '../hooks/useEscapeKey';

function KeyBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center justify-center min-w-7 h-6 px-1.5 whitespace-nowrap rounded-card border border-outline-variant/60 bg-surface-container-lowest shadow-sm font-ui text-xs text-on-surface-variant">
      {children}
    </span>
  );
}

type KeyboardShortcutsHintProps = {
  // Lets a caller (e.g. ReactionControl sitting right next to this) suspend
  // its own "R" / number-key shortcuts while this popover is open on top of
  // it — otherwise "R" would open the reaction picker underneath, and one
  // Escape press would then close both overlays at once.
  onOpenChange?: (isOpen: boolean) => void;
};

/** Desktop-only info affordance explaining the viewer's keyboard shortcuts. */
export default function KeyboardShortcutsHint({ onOpenChange }: KeyboardShortcutsHintProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const outsideClickRefs = useMemo(() => [panelRef, triggerRef], []);
  const headingId = useId();

  useEffect(() => onOpenChange?.(isOpen), [isOpen, onOpenChange]);

  const close = useCallback(() => setIsOpen(false), []);
  useFocusTrap(panelRef, isOpen);
  useOutsideClick(outsideClickRefs, close, isOpen);
  useEscapeKey(isOpen, close);

  return (
    <div className="hidden md:inline-flex relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Keyboard shortcuts"
        className="w-10 h-10 rounded-full bg-surface-container-lowest border border-outline-variant/50 shadow-md flex items-center justify-center text-on-surface-variant hover:border-secondary hover:text-secondary transition-colors focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
      >
        <Icon name="info" className="text-lg" />
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          className="absolute bottom-full right-0 mb-2 bg-surface-container-lowest paper-depth border border-outline-variant/40 rounded-panel p-4 w-64 z-20"
        >
          <div className="flex justify-between items-start mb-3">
            <h2 id={headingId} className="font-ui text-ui-label uppercase text-on-surface-variant">
              Shortcuts for this volume
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close shortcuts"
              className="text-on-surface-variant hover:text-primary transition-colors shrink-0 ml-2 rounded-full focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
            >
              <Icon name="close" className="text-xl" />
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            <li className="flex items-center gap-2">
              <KeyBadge>←</KeyBadge>
              <KeyBadge>→</KeyBadge>
              <span className="font-body text-sm text-on-surface">Turn to the previous or next photo</span>
            </li>
            <li className="flex items-center gap-2">
              <KeyBadge>R</KeyBadge>
              <span className="font-body text-sm text-on-surface">Open the reaction picker</span>
            </li>
            <li className="flex items-center gap-2">
              <KeyBadge>1–6</KeyBadge>
              <span className="font-body text-sm text-on-surface">
                Pick a reaction — Like, Love, Haha, Wow, Sad, Angry
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
