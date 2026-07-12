import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import useFocusTrap from '../hooks/useFocusTrap';
import useOutsideClick from '../hooks/useOutsideClick';
import useEscapeKey from '../hooks/useEscapeKey';
import { REACTION_TYPES, type ReactionSummary, type ReactionType } from '../features/flipbooks';
import { REACTION_ICON, REACTION_TEXT_COLOR } from './reactionPresentation';
import ReactorsModal from './ReactorsModal';

type ReactionControlProps = {
  /** Identifies which page/photo this control is showing reactions for — used to close the picker when the underlying photo changes. */
  pageId: string;
  reactions: ReactionSummary;
  onReact: (type: ReactionType) => void;
  isPending: boolean;
  /** light = paper surface (ViewerPage), dark = photo overlay (PhotoLightbox). */
  variant: 'light' | 'dark';
  // True while some other, topmost surface (e.g. the lightbox) already owns
  // the keyboard — this instance keeps rendering underneath it, so without
  // this it would also react to the same "r" / number-key presses.
  isKeyboardShortcutsDisabled?: boolean;
  /** The signed-in viewer's own username, passed through to the "who reacted" list so it can offer a remove button on their own row. */
  viewerUsername?: string;
};

const REACTION_SHORTCUT_KEYS: Record<ReactionType, string> = {
  like: '1',
  love: '2',
  haha: '3',
  wow: '4',
  sad: '5',
  angry: '6',
};

const REACTION_LABEL: Record<ReactionType, string> = {
  like: 'Like',
  love: 'Love',
  haha: 'Haha',
  wow: 'Wow',
  sad: 'Sad',
  angry: 'Angry',
};

const MAX_SUMMARY_ICONS = 3;

/** Facebook-style reaction trigger + picker popover, for a single page/photo. */
export default function ReactionControl({
  pageId,
  reactions,
  onReact,
  isPending,
  variant,
  isKeyboardShortcutsDisabled = false,
  viewerUsername,
}: ReactionControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isReactorsModalOpen, setIsReactorsModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const outsideClickRefs = useMemo(() => [panelRef, triggerRef], []);

  // This same component instance is reused across photo navigation (no
  // `key` prop), and PhotoLightbox's arrow-key navigation changes the
  // current photo via a window keydown listener that bypasses
  // useOutsideClick — so without this, the picker (and the reactors modal)
  // could stay open, re-anchored to a different photo than the one it was
  // opened for. Resetting synchronously during render (rather than in an
  // effect) avoids a frame where the stale picker is still visible. See:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [lastPageId, setLastPageId] = useState(pageId);
  if (pageId !== lastPageId) {
    setLastPageId(pageId);
    setIsOpen(false);
    setIsReactorsModalOpen(false);
  }

  const close = useCallback(() => setIsOpen(false), []);
  useFocusTrap(panelRef, isOpen);
  useOutsideClick(outsideClickRefs, close, isOpen);
  // Deactivated while the reactors modal — or another topmost surface like
  // KeyboardShortcutsHint — is open on top of it: both listen on document,
  // and Escape's stopPropagation() only blocks propagation to ancestors, not
  // a sibling listener on the same node — without this, one Escape press
  // would close both instead of just the topmost one.
  useEscapeKey(isOpen && !isReactorsModalOpen && !isKeyboardShortcutsDisabled, close);

  const handleSelect = useCallback(
    (type: ReactionType) => {
      onReact(type);
      close();
    },
    [onReact, close]
  );

  // "R" toggles the picker open/closed, same as clicking the trigger; once
  // it's open, each reaction's number key (see REACTION_SHORTCUT_KEYS) picks
  // it immediately, for a fast keyboard-only react.
  useEffect(() => {
    if (isKeyboardShortcutsDisabled || isPending || isReactorsModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        setIsOpen((open) => !open);
        return;
      }
      if (!isOpen) return;
      const shortcutType = REACTION_TYPES.find((type) => REACTION_SHORTCUT_KEYS[type] === event.key);
      if (shortcutType) {
        event.preventDefault();
        handleSelect(shortcutType);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isKeyboardShortcutsDisabled, isPending, isReactorsModalOpen, isOpen, handleSelect]);

  const { viewerReaction, counts, total, reactors } = reactions;

  // Removing is just re-sending the viewer's current type — the server
  // treats picking the same reaction twice as a toggle-off, same as
  // re-clicking it in the picker above.
  const removeMyReaction = () => {
    if (viewerReaction) onReact(viewerReaction);
  };
  const isLight = variant === 'light';

  const topReactionTypes = REACTION_TYPES.filter((type) => counts[type] > 0)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, MAX_SUMMARY_ICONS);

  const triggerAriaLabel = viewerReaction
    ? `You reacted: ${REACTION_LABEL[viewerReaction]}. Tap to change or remove.`
    : 'React to this photo';

  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={isPending}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={triggerAriaLabel}
        title={isKeyboardShortcutsDisabled ? undefined : `${triggerAriaLabel} (R)`}
        className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors disabled:opacity-60 disabled:pointer-events-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 ${
          isLight
            ? `hover:bg-surface-container-low ${
                viewerReaction ? REACTION_TEXT_COLOR[viewerReaction] : 'text-on-surface-variant hover:text-secondary'
              }`
            : `hover:bg-white/10 ${viewerReaction ? REACTION_TEXT_COLOR[viewerReaction] : 'text-white/80 hover:text-white'}`
        }`}
      >
        {isPending ? (
          <Icon name="progress_activity" className="text-xl animate-spin" />
        ) : (
          <Icon
            name={viewerReaction ? REACTION_ICON[viewerReaction] : 'thumb_up'}
            className="text-xl"
            filled={viewerReaction !== null}
          />
        )}
      </button>

      {total > 0 && (
        <button
          type="button"
          onClick={() => setIsReactorsModalOpen(true)}
          aria-haspopup="dialog"
          aria-label={`See who reacted (${total})`}
          title={topReactionTypes
            .map((type) => `${REACTION_LABEL[type]}: ${counts[type]}`)
            .join(' · ')}
          className={`rounded-full px-2 py-1.5 font-ui text-sm transition-colors focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 ${
            isLight
              ? 'text-on-surface-variant hover:bg-surface-container-low hover:text-secondary'
              : 'text-white/70 hover:text-white'
          }`}
        >
          {total}
        </button>
      )}

      {isOpen && (
        <div
          ref={panelRef}
          role="group"
          aria-label="Choose a reaction"
          className={`absolute bottom-full left-0 mb-2 flex items-center gap-1 rounded-full px-2 py-1.5 z-20 ${
            isLight
              ? 'bg-surface-container-lowest paper-depth border border-outline-variant/40'
              : 'bg-inverse-surface'
          }`}
        >
          {REACTION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleSelect(type)}
              aria-label={REACTION_LABEL[type]}
              aria-pressed={viewerReaction === type}
              title={
                isKeyboardShortcutsDisabled
                  ? REACTION_LABEL[type]
                  : `${REACTION_LABEL[type]} (${REACTION_SHORTCUT_KEYS[type]})`
              }
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-secondary ${
                viewerReaction === type ? (isLight ? 'bg-surface-container-low scale-110' : 'bg-white/20 scale-110') : ''
              } ${REACTION_TEXT_COLOR[type]}`}
            >
              <Icon name={REACTION_ICON[type]} className="text-xl" filled />
            </button>
          ))}
        </div>
      )}

      <ReactorsModal
        isOpen={isReactorsModalOpen}
        onClose={() => setIsReactorsModalOpen(false)}
        heading="People who reacted"
        reactors={reactors}
        viewerUsername={viewerUsername}
        onRemoveMyReaction={viewerReaction ? removeMyReaction : undefined}
      />
    </div>
  );
}
