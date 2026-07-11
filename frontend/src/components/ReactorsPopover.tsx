import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import Icon from './Icon';
import useFocusTrap from '../hooks/useFocusTrap';
import useOutsideClick from '../hooks/useOutsideClick';
import useEscapeKey from '../hooks/useEscapeKey';
import type { Reactor } from '../features/flipbooks';
import { REACTION_ICON, REACTION_TEXT_COLOR } from './reactionPresentation';

type ReactorsPopoverProps = {
  reactors: Reactor[];
  /** Accessible name for the trigger button, e.g. "See who reacted (5)". */
  triggerAriaLabel: string;
  /** Accessible name for the opened list, e.g. "People who reacted" — kept
   * distinct from triggerAriaLabel so a screen reader doesn't announce the
   * same action-phrased string twice (once for the button, once for the
   * group it opens). */
  panelAriaLabel: string;
  /** Hover tooltip on the trigger, e.g. a per-type count breakdown
   * ("Love: 3 · Like: 2") — optional since a love-only summary (albums)
   * has no breakdown worth showing. */
  triggerTitle?: string;
  /** light = paper surface, dark = photo overlay — matches ReactionControl's variant split. */
  variant: 'light' | 'dark';
  className?: string;
  /** The trigger button's visible content (e.g. icons + count). */
  children: ReactNode;
};

/** Click-to-open list of everyone who reacted, for a photo or an album. */
export default function ReactorsPopover({
  reactors,
  triggerAriaLabel,
  panelAriaLabel,
  triggerTitle,
  variant,
  className = '',
  children,
}: ReactorsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const outsideClickRefs = useMemo(() => [panelRef, triggerRef], []);

  const close = useCallback(() => setIsOpen(false), []);
  useFocusTrap(panelRef, isOpen);
  useOutsideClick(outsideClickRefs, close, isOpen);
  useEscapeKey(isOpen, close);

  const isLight = variant === 'light';

  return (
    <div className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={triggerAriaLabel}
        title={triggerTitle}
        className={`flex items-center gap-1 rounded-full transition-colors ${className}`}
      >
        {children}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          role="group"
          aria-label={panelAriaLabel}
          className={`absolute top-full right-0 mt-2 w-48 max-h-60 overflow-y-auto rounded-card p-2 z-20 ${
            isLight
              ? 'bg-surface-container-lowest paper-depth border border-outline-variant/40'
              : 'bg-inverse-surface'
          }`}
        >
          {/* A read-only list has nothing else to focus, so this is the
              popover's only Tab stop — gives the focus trap somewhere to
              land and a discoverable keyboard way to dismiss it, rather
              than relying on Escape alone. */}
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className={`flex items-center justify-center ml-auto w-6 h-6 rounded-full transition-colors ${
              isLight
                ? 'text-on-surface-variant hover:text-secondary'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <Icon name="close" className="text-base" />
          </button>
          <ul>
            {reactors.map((reactor, index) => (
              <li
                key={`${reactor.username}-${index}`}
                title={reactor.username}
                className={`flex items-center gap-2 px-2 py-1.5 font-ui text-sm ${
                  isLight ? 'text-on-surface' : 'text-white'
                }`}
              >
                <Icon
                  name={REACTION_ICON[reactor.type]}
                  filled
                  className={`text-sm shrink-0 ${REACTION_TEXT_COLOR[reactor.type]}`}
                />
                <span className="truncate">{reactor.username}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
