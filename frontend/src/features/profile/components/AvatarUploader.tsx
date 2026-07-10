import type { ChangeEvent } from 'react';
import Avatar from '../../../components/Avatar';
import Icon from '../../../components/Icon';
import { useUploadAvatar, useRemoveAvatar } from '../hooks';
import { toast } from '../../../lib/toast';
import { ALLOWED_PHOTO_MIME_TYPES, MAX_PHOTO_SIZE_BYTES } from '../../flipbooks';

const ACCEPTED_FILE_TYPES = 'image/jpeg,image/png,image/webp,image/gif';

function isAllowedPhotoType(type: string): type is (typeof ALLOWED_PHOTO_MIME_TYPES)[number] {
  return (ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(type);
}

type AvatarUploaderProps = {
  username: string;
  avatarUrl?: string | null;
};

export default function AvatarUploader({ username, avatarUrl }: AvatarUploaderProps) {
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();
  const isBusy = uploadAvatar.isPending || removeAvatar.isPending;

  const onFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!isAllowedPhotoType(file.type)) {
      toast.error('Only JPEG, PNG, WEBP and GIF photos are supported.');
      return;
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      toast.error('Photo is too large. Choose one under 10MB.');
      return;
    }

    uploadAvatar.mutate(file, {
      onError: (error) => toast.error(error.message),
    });
  };

  const onRemove = () => {
    removeAvatar.mutate(undefined, {
      onSuccess: () => toast.success('Photo removed.'),
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <Avatar username={username} avatarUrl={avatarUrl} size="lg" />
        {isBusy && (
          <div className="absolute inset-0 rounded-full bg-primary/40 flex items-center justify-center">
            <Icon name="progress_activity" className="animate-spin text-2xl text-on-primary" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        <label className="font-ui text-ui-label uppercase text-secondary cursor-pointer hover:opacity-80 transition-opacity">
          Change photo
          <input
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            disabled={isBusy}
            className="sr-only"
            onChange={onFileSelected}
          />
        </label>
        {avatarUrl && (
          <button
            type="button"
            onClick={onRemove}
            disabled={isBusy}
            className="font-ui text-ui-label uppercase text-on-surface-variant hover:text-error transition-colors disabled:opacity-40"
          >
            Remove photo
          </button>
        )}
      </div>
    </div>
  );
}
