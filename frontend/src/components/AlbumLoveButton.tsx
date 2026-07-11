import Icon from './Icon';
import { REACTION_ICON, REACTION_TEXT_COLOR } from './reactionPresentation';

type AlbumLoveButtonProps = {
  isLoved: boolean;
  count: number;
  onToggle: () => void;
  isPending: boolean;
};

/** Toggle for loving an entire album, shown in the viewer header. */
export default function AlbumLoveButton({ isLoved, count, onToggle, isPending }: AlbumLoveButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isPending}
      aria-pressed={isLoved}
      aria-label={isLoved ? 'You loved this album — tap to remove' : 'Love this album'}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-surface-container-lowest border shadow-md font-ui transition-colors focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none ${
        isLoved
          ? `border-current ${REACTION_TEXT_COLOR.love}`
          : 'border-outline-variant/50 text-on-surface-variant hover:border-secondary hover:text-secondary'
      }`}
    >
      {isPending ? (
        <Icon name="progress_activity" className="text-lg animate-spin" />
      ) : (
        <Icon name={REACTION_ICON.love} className="text-lg" filled={isLoved} />
      )}
      <span className="font-ui text-sm">{count}</span>
    </button>
  );
}
