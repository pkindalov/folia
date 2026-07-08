import { useEffect, useState } from 'react';
import Icon from '../../../components/Icon';
import { MAX_CAPTION_LENGTH } from '../../flipbooks';

type Photo = {
  _id: string;
  url: string;
  filename?: string;
  caption?: string;
};

type PageThumbnailProps = {
  photo: Photo;
  index: number;
  isDeleting: boolean;
  isCover: boolean;
  isSettingCover: boolean;
  isSavingCaption: boolean;
  onRemove: () => void;
  onSetCover: () => void;
  onOpenPhoto: () => void;
  onCaptionChange: (caption: string) => void;
};

const ROTATION_CLASSES = ['rotate-1', '-rotate-2', 'rotate-2', '-rotate-1'];

export default function PageThumbnail({
  photo,
  index,
  isDeleting,
  isCover,
  isSettingCover,
  isSavingCaption,
  onRemove,
  onSetCover,
  onOpenPhoto,
  onCaptionChange,
}: PageThumbnailProps) {
  const rotationClass = ROTATION_CLASSES[index % ROTATION_CLASSES.length];
  const [caption, setCaption] = useState(photo.caption ?? '');

  // Re-sync only when the photo itself changes identity, not on every
  // caption prop update — an unrelated refetch (e.g. deleting another
  // photo) shouldn't clobber an in-progress, unsaved edit.
  useEffect(() => {
    setCaption(photo.caption ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo._id]);

  // Saved explicitly rather than on blur, so only one save is ever in
  // flight for this caption — two quick blurs used to be able to fire two
  // overlapping requests, and whichever the server saw last would win,
  // sometimes silently reverting a newer edit.
  const hasUnsavedCaption = caption !== (photo.caption ?? '');

  const handleSaveCaption = () => {
    if (hasUnsavedCaption) onCaptionChange(caption);
  };

  return (
    <div
      className={`relative bg-white p-1.5 stuck-photo rounded-paper hover:-translate-y-0.5 transition-transform ${rotationClass}`}
    >
      <button
        type="button"
        onClick={onOpenPhoto}
        aria-label={`View ${photo.filename || 'this photo'} full size`}
        className="block w-full cursor-zoom-in"
      >
        <img
          src={photo.url}
          alt={photo.filename || 'Volume page photo'}
          className="aspect-square object-cover w-full rounded-[1px]"
        />
      </button>
      <button
        type="button"
        onClick={onSetCover}
        disabled={isCover || isSettingCover}
        aria-label={isCover ? 'This is the cover photo' : `Set ${photo.filename || 'this photo'} as the cover`}
        title={isCover ? 'Cover photo' : 'Set as cover'}
        className={`absolute -top-2 -left-2 w-7 h-7 rounded-full bg-surface-container-lowest border shadow-md flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 ${
          isCover
            ? 'border-secondary text-secondary'
            : 'border-outline-variant/50 text-on-surface-variant hover:text-secondary hover:border-secondary/50'
        }`}
      >
        {isSettingCover ? (
          <Icon name="progress_activity" className="text-sm animate-spin" />
        ) : (
          <Icon name="star" className="text-sm" filled={isCover} />
        )}
      </button>
      <textarea
        value={caption}
        onChange={(event) => setCaption(event.target.value)}
        rows={2}
        maxLength={MAX_CAPTION_LENGTH}
        placeholder="Tell its story…"
        aria-label={`Caption for ${photo.filename || 'this photo'}`}
        className="mt-1.5 w-full px-1 py-0.5 font-body italic text-xs text-on-surface-variant text-center bg-transparent border-none resize-none focus:outline-none focus-visible:ring-1 focus-visible:ring-secondary/50 rounded-xs"
      />
      {hasUnsavedCaption && (
        <button
          type="button"
          onClick={handleSaveCaption}
          disabled={isSavingCaption}
          aria-label={`Save caption for ${photo.filename || 'this photo'}`}
          className="mt-0.5 w-full flex items-center justify-center gap-1 font-ui text-[10px] uppercase tracking-wide text-secondary hover:text-primary disabled:opacity-50 transition-colors"
        >
          {isSavingCaption ? (
            <Icon name="progress_activity" className="text-xs animate-spin" />
          ) : (
            <Icon name="save" className="text-xs" />
          )}
          {isSavingCaption ? 'Saving…' : 'Save caption'}
        </button>
      )}
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
