import { Link } from 'react-router-dom';
import Modal from './Modal';
import Icon from './Icon';

type AlbumReactorsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Usernames only — albums are love-only, capped server-side at 50, so there's no pagination here. */
  reactors: string[];
};

/** Everyone who's loved an album, each linking to their profile. */
export default function AlbumReactorsModal({ isOpen, onClose, reactors }: AlbumReactorsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} labelledBy="album-reactors-title">
      <div className="flex justify-between items-start mb-6">
        <h2 id="album-reactors-title" className="font-display text-headline-md text-primary">
          People who loved this album
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
        {reactors.map((username) => (
          <li key={username}>
            <Link
              to={`/users/${encodeURIComponent(username)}`}
              onClick={onClose}
              className="flex items-center gap-2 px-2 py-2 rounded-paper font-ui text-on-surface hover:bg-surface-container-low hover:text-secondary transition-colors"
            >
              {username}
            </Link>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
