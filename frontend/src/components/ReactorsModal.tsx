import { useId } from 'react';
import { Link } from 'react-router-dom';
import Modal from './Modal';
import Icon from './Icon';
import { REACTION_ICON, REACTION_TEXT_COLOR } from './reactionPresentation';
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
};

/** Everyone who's reacted — to a photo or an album — each linking to their profile. */
export default function ReactorsModal({ isOpen, onClose, heading, reactors }: ReactorsModalProps) {
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
              <Icon
                name={REACTION_ICON[reactor.type]}
                filled
                className={`text-base shrink-0 ${REACTION_TEXT_COLOR[reactor.type]}`}
              />
              <span className="truncate">{reactor.username}</span>
            </>
          );

          return (
            <li key={`${reactor.username}-${index}`}>
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
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
