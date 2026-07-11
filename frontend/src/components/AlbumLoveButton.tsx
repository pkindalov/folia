import Icon from './Icon';
import { REACTION_ICON, REACTION_TEXT_COLOR } from './reactionPresentation';

type AlbumLoveButtonProps = {
  isLoved: boolean;
  count: number;
  onToggle: () => void;
  onCountClick: () => void;
  isPending: boolean;
};

/** Loving an entire album (heart) plus who's loved it (count), shown in the viewer header. */
export default function AlbumLoveButton({
  isLoved,
  count,
  onToggle,
  onCountClick,
  isPending,
}: AlbumLoveButtonProps) {
  return (
    <div
      className={`flex items-center rounded-full bg-surface-container-lowest border shadow-md font-ui transition-colors ${
        isLoved
          ? `border-current ${REACTION_TEXT_COLOR.love}`
          : 'border-outline-variant/50 text-on-surface-variant hover:border-secondary'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={isPending}
        aria-pressed={isLoved}
        aria-label={isLoved ? 'You loved this album — tap to remove' : 'Love this album'}
        className="flex items-center pl-3 pr-1.5 py-1.5 rounded-l-full transition-colors focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none hover:text-secondary"
      >
        {isPending ? (
          <Icon name="progress_activity" className="text-lg animate-spin" />
        ) : (
          <Icon name={REACTION_ICON.love} className="text-lg" filled={isLoved} />
        )}
      </button>
      <button
        type="button"
        onClick={onCountClick}
        disabled={count === 0}
        aria-label={`See who loved this album (${count})`}
        className="pr-3 pl-1.5 py-1.5 rounded-r-full font-ui text-sm transition-colors hover:text-secondary focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none"
      >
        {count}
      </button>
    </div>
  );
}
