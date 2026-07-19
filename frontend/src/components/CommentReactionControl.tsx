import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Emoji from './Emoji';
import useOutsideClick from '../hooks/useOutsideClick';
import useEscapeKey from '../hooks/useEscapeKey';
import { REACTION_TYPES, type ReactionSummary, type ReactionType } from '../features/flipbooks';
import { REACTION_EMOJI, REACTION_LABEL, REACTION_TEXT_COLOR } from './reactionPresentation';
import ReactorsModal from './ReactorsModal';

type CommentReactionControlProps = {
  reactions: ReactionSummary;
  onReact: (type: ReactionType) => void;
  isPending: boolean;
  /** light = paper surface (AlbumSpread), dark = photo overlay (PhotoLightbox). Mirrors ReactionControl's variant. */
  variant: 'light' | 'dark';
  viewerUsername?: string;
};

// Vertical gap between the trigger and the picker it anchors to.
const PICKER_ANCHOR_GAP_PX = 8;

/**
 * Facebook-style "Like" text trigger + reaction picker, sized for a single
 * comment/reply row rather than a full photo — CommentControl's thread panel
 * has many of these mounted at once, so unlike ReactionControl this doesn't
 * wire up any global keyboard shortcuts (there's no single row for "R" to
 * mean anything for) and anchors its picker with a measured fixed position
 * (mirroring NotificationBell's computeAnchorStyle) instead of a plain
 * `absolute` popover, since the comment thread it lives in scrolls — an
 * absolutely-positioned popover would get clipped by that scroll container.
 */
export default function CommentReactionControl({
  reactions,
  onReact,
  isPending,
  variant,
  viewerUsername,
}: CommentReactionControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isReactorsModalOpen, setIsReactorsModalOpen] = useState(false);
  const [anchorStyle, setAnchorStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const outsideClickRefs = useMemo(() => [panelRef, triggerRef], []);

  const close = useCallback(() => setIsOpen(false), []);
  useOutsideClick(outsideClickRefs, close, isOpen);
  useEscapeKey(isOpen && !isReactorsModalOpen, close);

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updateAnchor = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setAnchorStyle({ bottom: window.innerHeight - rect.top + PICKER_ANCHOR_GAP_PX, left: rect.left });
    };
    updateAnchor();

    window.addEventListener('resize', updateAnchor);
    // Closing on scroll (rather than repositioning) keeps this simple — the
    // comment thread is the only scrollable ancestor a picker can open
    // inside, and scrolling away from an open picker is rare enough that
    // just dismissing it, same as an outside click would, is enough.
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', updateAnchor);
      window.removeEventListener('scroll', close, true);
    };
  }, [isOpen, close]);

  const handleSelect = (type: ReactionType) => {
    onReact(type);
    close();
  };

  const { viewerReaction, total, reactors } = reactions;
  const removeMyReaction = () => {
    if (viewerReaction) onReact(viewerReaction);
  };
  const isLight = variant === 'light';

  const triggerLabel = viewerReaction ? REACTION_LABEL[viewerReaction] : 'Like';
  const triggerAriaLabel = viewerReaction
    ? `You reacted: ${REACTION_LABEL[viewerReaction]}. Tap to change or remove.`
    : 'React to this comment';

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={isPending}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={triggerAriaLabel}
        className={`font-ui text-xs font-semibold uppercase tracking-wide transition-colors disabled:opacity-60 disabled:pointer-events-none ${
          viewerReaction
            ? REACTION_TEXT_COLOR[viewerReaction]
            : isLight
              ? 'text-on-surface-variant hover:text-secondary'
              : 'text-white/50 hover:text-white'
        }`}
      >
        {triggerLabel}
      </button>

      {total > 0 && (
        <button
          type="button"
          onClick={() => setIsReactorsModalOpen(true)}
          aria-haspopup="dialog"
          aria-label={`See who reacted (${total})`}
          className={`font-ui text-xs transition-colors ${
            isLight ? 'text-on-surface-variant hover:text-secondary' : 'text-white/50 hover:text-white'
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
          style={anchorStyle}
          className={`fixed flex items-center gap-1 rounded-full px-2 py-1.5 z-70 ${
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
              title={REACTION_LABEL[type]}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-secondary ${
                viewerReaction === type ? (isLight ? 'bg-surface-container-low scale-110' : 'bg-white/20 scale-110') : ''
              } ${REACTION_TEXT_COLOR[type]}`}
            >
              <Emoji emoji={REACTION_EMOJI[type]} className="text-lg" />
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
        onRemoveMyReaction={viewerReaction && !isPending ? removeMyReaction : undefined}
      />
    </span>
  );
}
