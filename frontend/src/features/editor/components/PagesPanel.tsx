import { useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../../../components/Icon';
import PhotoLightbox from '../../../components/PhotoLightbox';
import PageThumbnail from './PageThumbnail';

type Photo = {
  _id: string;
  url: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  caption?: string;
};

type PagesPanelProps = {
  locked: boolean;
  photos: Photo[];
  isUploading: boolean;
  rejections: string[];
  deletingPhotoIds?: Set<string>;
  coverPhotoId?: string;
  settingCoverPhotoIds?: Set<string>;
  savingCaptionPhotoIds?: Set<string>;
  onFilesSelected: (files: File[]) => void;
  onRemovePhoto: (photoId: string) => void;
  onSetCoverPhoto: (photoId: string) => void;
  onDismissRejections: () => void;
  onCaptionChange: (photoId: string, caption: string) => void;
};

const ACCEPTED_FILE_TYPES = 'image/jpeg,image/png,image/webp,image/gif';
const EMPTY_ID_SET: Set<string> = new Set();

function getDropzoneColorClasses(isDraggingOver: boolean, isUploading: boolean) {
  if (!isUploading && isDraggingOver) {
    return 'border-secondary bg-secondary/5 text-secondary';
  }
  return 'border-outline-variant text-on-surface-variant';
}

export default function PagesPanel({
  locked,
  photos,
  isUploading,
  rejections,
  deletingPhotoIds = EMPTY_ID_SET,
  coverPhotoId,
  settingCoverPhotoIds = EMPTY_ID_SET,
  savingCaptionPhotoIds = EMPTY_ID_SET,
  onFilesSelected,
  onRemovePhoto,
  onSetCoverPhoto,
  onDismissRejections,
  onCaptionChange,
}: PagesPanelProps) {
  const { t } = useTranslation('editor');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  // Tracked by photo id, not array index — a raw index would go stale (and
  // could silently point at an unrelated photo) once the currently-open
  // photo is removed and the list later grows back to that length.
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null);
  const lightboxIndex = openPhotoId ? photos.findIndex((photo) => photo._id === openPhotoId) : -1;

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDraggingOver(false);
    onFilesSelected(Array.from(event.dataTransfer.files));
  };

  if (locked) {
    return (
      <div className="w-full h-full flex flex-col gap-4">
        <span className="font-ui text-ui-label uppercase text-on-surface-variant">
          {t('pagesPanel.pagesLabel')}
        </span>
        <div className="w-full h-full min-h-70 border border-outline-variant/40 bg-surface-container-low rounded-card flex flex-col items-center justify-center gap-4">
          <Icon name="add_photo_alternate" className="text-5xl text-on-surface-variant/50" />
          <p className="font-body italic text-on-surface-variant">
            {t('pagesPanel.saveFirst')}
          </p>
          <p className="font-ui text-ui-label uppercase text-xs text-on-surface-variant/50">
            {t('pagesPanel.unlockHint')}
          </p>
        </div>
      </div>
    );
  }

  const dropzoneColorClasses = getDropzoneColorClasses(isDraggingOver, isUploading);
  const hasPhotos = photos.length > 0;

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="font-ui text-ui-label uppercase text-on-surface-variant">
          {t('pagesPanel.pagesLabel')}
        </span>
        {hasPhotos && (
          <span className="font-ui text-ui-label uppercase text-on-surface-variant/60">
            {t('pagesPanel.pageCount', { count: photos.length })}
          </span>
        )}
      </div>

      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-card transition-colors focus-within:ring-2 focus-within:ring-secondary focus-within:ring-offset-2 ${dropzoneColorClasses} ${
          isUploading ? 'pointer-events-none opacity-70' : 'cursor-pointer'
        } ${
          hasPhotos
            ? 'h-24 flex items-center justify-center gap-3'
            : 'flex-1 w-full h-full min-h-70 flex flex-col items-center justify-center gap-3'
        }`}
      >
        <input
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          disabled={isUploading}
          className="sr-only"
          onChange={(event) => event.target.files && onFilesSelected(Array.from(event.target.files))}
        />
        {isUploading ? (
          <>
            <Icon name="progress_activity" className="animate-spin text-2xl text-secondary" />
            <span className="font-ui text-ui-label uppercase text-sm text-on-surface-variant">
              {t('pagesPanel.uploading')}
            </span>
          </>
        ) : hasPhotos ? (
          <>
            <Icon name="add_photo_alternate" className="text-2xl" />
            <div className="flex flex-col">
              <span className="font-ui text-ui-label uppercase text-sm">{t('pagesPanel.addMorePages')}</span>
              <span className="text-xs text-on-surface-variant/70">{t('pagesPanel.orDragPhotos')}</span>
            </div>
          </>
        ) : (
          <>
            <Icon name="add_photo_alternate" className="text-5xl" />
            <p className="font-body italic">{t('pagesPanel.dropFirstPages')}</p>
            <p className="font-ui text-ui-label uppercase text-xs">{t('pagesPanel.orClickToChoose')}</p>
            <p className="text-xs text-on-surface-variant/70">
              {t('pagesPanel.fileHint')}
            </p>
          </>
        )}
      </label>

      {rejections.length > 0 && (
        <div
          role="alert"
          className="px-4 py-3 bg-error-container text-on-error-container rounded-paper font-ui text-sm relative"
        >
          <button
            type="button"
            onClick={onDismissRejections}
            aria-label={t('pagesPanel.dismiss')}
            className="absolute top-2 right-2 text-on-error-container/70 hover:text-on-error-container"
          >
            <Icon name="close" className="text-base" />
          </button>
          <div className="flex flex-col gap-1 pr-6">
            {rejections.map((message, index) => (
              <p key={index}>{message}</p>
            ))}
          </div>
        </div>
      )}

      {hasPhotos && (
        <div className="grid grid-cols-1 gap-3 overflow-y-auto flex-1 p-2">
          {photos.map((photo, index) => (
            <PageThumbnail
              key={photo._id}
              photo={photo}
              index={index}
              isDeleting={deletingPhotoIds.has(photo._id)}
              isCover={photo._id === coverPhotoId}
              isSettingCover={settingCoverPhotoIds.has(photo._id)}
              isSavingCaption={savingCaptionPhotoIds.has(photo._id)}
              onRemove={() => onRemovePhoto(photo._id)}
              onSetCover={() => onSetCoverPhoto(photo._id)}
              onOpenPhoto={() => setOpenPhotoId(photo._id)}
              onCaptionChange={(caption) => onCaptionChange(photo._id, caption)}
            />
          ))}
        </div>
      )}

      {lightboxIndex !== -1 && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setOpenPhotoId(null)}
          onNavigate={(nextIndex) => setOpenPhotoId(photos[nextIndex]?._id ?? null)}
        />
      )}
    </div>
  );
}
