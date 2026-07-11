import { useCallback, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import useFocusTrap from '../hooks/useFocusTrap';
import useOutsideClick from '../hooks/useOutsideClick';
import useEscapeKey from '../hooks/useEscapeKey';
import { REACTION_TYPES, type ReactionSummary, type ReactionType } from '../features/flipbooks';
import { REACTION_ICON, REACTION_TEXT_COLOR } from './reactionPresentation';
import ReactorsPopover from './ReactorsPopover';

type ReactionControlProps = {
  /** Identifies which page/photo this control is showing reactions for — used to close the picker when the underlying photo changes. */
  pageId: string;
  reactions: ReactionSummary;
  onReact: (type: ReactionType) => void;
  isPending: boolean;
  /** light = paper surface (ViewerPage), dark = photo overlay (PhotoLightbox). */
  variant: 'light' | 'dark';
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
export default function ReactionControl({ pageId, reactions, onReact, isPending, variant }: ReactionControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const outsideClickRefs = useMemo(() => [panelRef, triggerRef], []);

  // This same component instance is reused across photo navigation (no
  // `key` prop), and PhotoLightbox's arrow-key navigation changes the
  // current photo via a window keydown listener that bypasses
  // useOutsideClick — so without this, the picker could stay open,
  // re-anchored to a different photo than the one it was opened for.
  // Resetting synchronously during render (rather than in an effect) avoids
  // a frame where the stale picker is still visible. See:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [lastPageId, setLastPageId] = useState(pageId);
  if (pageId !== lastPageId) {
    setLastPageId(pageId);
    setIsOpen(false);
  }

  const close = useCallback(() => setIsOpen(false), []);
  useFocusTrap(panelRef, isOpen);
  useOutsideClick(outsideClickRefs, close, isOpen);
  useEscapeKey(isOpen, close);

  const handleSelect = (type: ReactionType) => {
    onReact(type);
    close();
  };

  const { viewerReaction, counts, total, reactors } = reactions;
  const isLight = variant === 'light';

  const topReactionTypes = REACTION_TYPES.filter((type) => counts[type] > 0)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, MAX_SUMMARY_ICONS);

  const triggerLabel = viewerReaction ? REACTION_LABEL[viewerReaction] : 'React';
  const triggerAriaLabel = viewerReaction
    ? `You reacted: ${REACTION_LABEL[viewerReaction]}. Tap to change or remove.`
    : 'React to this photo';

  return (
    <div className="relative inline-flex items-center gap-2">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={isPending}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={triggerAriaLabel}
        className={`flex items-center gap-1.5 rounded-full px-4 py-2 font-ui text-ui-label uppercase transition-colors disabled:opacity-60 disabled:pointer-events-none ${
          isLight
            ? `bg-surface-container-lowest border shadow-md focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 ${
                viewerReaction
                  ? `border-current ${REACTION_TEXT_COLOR[viewerReaction]}`
                  : 'border-outline-variant/50 text-on-surface-variant hover:border-secondary hover:text-secondary'
              }`
            : `bg-white/10 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                viewerReaction ? REACTION_TEXT_COLOR[viewerReaction] : 'text-white/80'
              }`
        }`}
      >
        {isPending ? (
          <Icon name="progress_activity" className="text-lg animate-spin" />
        ) : (
          <Icon
            name={viewerReaction ? REACTION_ICON[viewerReaction] : 'thumb_up'}
            className="text-lg"
            filled={viewerReaction !== null}
          />
        )}
        {triggerLabel}
      </button>

      {total > 0 && (
        <ReactorsPopover
          reactors={reactors}
          variant={variant}
          triggerAriaLabel={`See who reacted (${total})`}
          panelAriaLabel="People who reacted"
          triggerTitle={topReactionTypes
            .map((type) => `${REACTION_LABEL[type]}: ${counts[type]}`)
            .join(' · ')}
        >
          {topReactionTypes.map((type) => (
            <Icon
              key={type}
              name={REACTION_ICON[type]}
              filled
              className={`text-sm ${REACTION_TEXT_COLOR[type]}`}
            />
          ))}
          <span className={`font-ui text-xs ${isLight ? 'text-on-surface-variant' : 'text-white/70'}`}>
            {total}
          </span>
        </ReactorsPopover>
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
              title={REACTION_LABEL[type]}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-secondary ${
                viewerReaction === type ? (isLight ? 'bg-surface-container-low scale-110' : 'bg-white/20 scale-110') : ''
              } ${REACTION_TEXT_COLOR[type]}`}
            >
              <Icon name={REACTION_ICON[type]} className="text-xl" filled />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
