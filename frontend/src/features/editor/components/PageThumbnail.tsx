import Icon from '../../../components/Icon';

type Photo = {
  _id: string;
  url: string;
  filename?: string;
};

type PageThumbnailProps = {
  photo: Photo;
  index: number;
  isDeleting: boolean;
  onRemove: () => void;
};

const ROTATION_CLASSES = ['rotate-1', '-rotate-2', 'rotate-2', '-rotate-1'];

export default function PageThumbnail({ photo, index, isDeleting, onRemove }: PageThumbnailProps) {
  const rotationClass = ROTATION_CLASSES[index % ROTATION_CLASSES.length];

  return (
    <div
      className={`relative bg-white p-1.5 stuck-photo rounded-paper hover:-translate-y-0.5 transition-transform ${rotationClass}`}
    >
      <img
        src={photo.url}
        alt={photo.filename || 'Volume page photo'}
        className="aspect-square object-cover w-full rounded-[1px]"
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={isDeleting}
        aria-label={`Remove ${photo.filename || 'this photo'}`}
        className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-surface-container-lowest border border-outline-variant/50 shadow-md flex items-center justify-center text-on-surface-variant hover:text-error hover:border-error/50 transition-colors focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2"
      >
        {isDeleting ? (
          <Icon name="progress_activity" className="text-sm animate-spin" />
        ) : (
          <Icon name="close" className="text-sm" />
        )}
      </button>
    </div>
  );
}
