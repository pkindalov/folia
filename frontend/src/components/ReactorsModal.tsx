import { useId } from 'react';
import { Link } from 'react-router-dom';
import Modal from './Modal';
import Icon from './Icon';
import Emoji from './Emoji';
import { REACTION_EMOJI } from './reactionPresentation';
import type { Reactor } from '../features/flipbooks';

// Mirrors the backend's DELETED_USER_LABEL fallback (controller-helpers.js) —
// that username never resolves to a real profile, so it shouldn't link to one.
const DELETED_USER_LABEL = 'Deleted user';

type ReactorsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** e.g. "People who loved this album" or "People who reacted". */
  heading: string;
  /** Capped server-side at 50 (per photo or per album), so there's no pagination here. */
  reactors: Reactor[];
  /**
   * The signed-in viewer's own stable id — lets their row offer a remove
   * button, compared against each reactor's own `user` id rather than
   * username so a stale cached username can never misattribute (or miss)
   * "is this me". Falls back to viewerUsername below only for reactor lists
   * that don't carry an id at all (album love reactors, resolved as bare
   * usernames server-side).
   */
  viewerId?: string;
  /** The signed-in viewer's own username — the fallback identity check where viewerId/reactor.user aren't available. Omit entirely where removal isn't wired up. */
  viewerUsername?: string;
  onRemoveMyReaction?: () => void;
};

/** Everyone who's reacted — to a photo or an album — each linking to their profile. */
export default function ReactorsModal({
  isOpen,
  onClose,
  heading,
  reactors,
  viewerId,
  viewerUsername,
  onRemoveMyReaction,
}: ReactorsModalProps) {
  // A unique id per instance — ReactorsModal can be mounted more than once at
  // once (a photo's ReactionControl and the album-level modal both live on
  // ViewerPage), so a shared static id would leave aria-labelledby pointing
  // at the wrong heading if two ever ended up open together.
  const headingId = useId();

  // JSX children are evaluated before Modal ever sees `isOpen`, so without
  // this the reactors.map below would still run on every render this
  // component is mounted for — including while closed, when a caller (e.g.
  // ReactionControl) always renders it regardless of whether there's
  // anything to react to yet.
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} labelledBy={headingId}>
      <div className="flex justify-between items-start mb-6">
        <h2 id={headingId} className="font-display text-headline-md text-primary">
          {heading}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-on-surface-variant hover:text-primary transition-colors shrink-0 ml-4"
        >
          <Icon name="close" className="text-2xl" />
        </button>
      </div>
      <ul className="flex flex-col gap-1 max-h-96 overflow-y-auto">
        {reactors.map((reactor, index) => {
          const rowContent = (
            <>
              <Emoji emoji={REACTION_EMOJI[reactor.type]} className="text-base shrink-0" />
              <span className="truncate">{reactor.username}</span>
            </>
          );

          const isMine =
            onRemoveMyReaction !== undefined &&
            (reactor.user !== undefined && viewerId !== undefined
              ? reactor.user === viewerId
              : reactor.username === viewerUsername);

          return (
            <li key={`${reactor.username}-${index}`} className="flex items-center gap-1">
              <div className="flex-1 min-w-0">
                {reactor.username === DELETED_USER_LABEL ? (
                  <div className="flex items-center gap-2 px-2 py-2 font-ui text-on-surface-variant">{rowContent}</div>
                ) : (
                  <Link
                    to={`/users/${encodeURIComponent(reactor.username)}`}
                    onClick={onClose}
                    className="flex items-center gap-2 px-2 py-2 rounded-paper font-ui text-on-surface hover:bg-surface-container-low hover:text-secondary transition-colors"
                  >
                    {rowContent}
                  </Link>
                )}
              </div>
              {isMine && (
                <button
                  type="button"
                  onClick={onRemoveMyReaction}
                  aria-label="Remove your reaction"
                  title="Remove your reaction"
                  className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container transition-colors"
                >
                  <Icon name="delete" className="text-lg" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
