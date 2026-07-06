import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import PagesPanel from '../components/PagesPanel';
import {
  albumFormSchema,
  type AlbumFormInput,
  useAlbum,
  useCreateAlbum,
  useUpdateAlbum,
  useDeleteAlbum,
  usePages,
  useUploadPages,
  useDeletePage,
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_SIZE_BYTES,
} from '../../flipbooks';

const VISIBILITY_OPTIONS = [
  ['private', 'lock', 'Private — only you'],
  ['shared', 'group', 'Shared — family circle'],
  ['public', 'public', 'Public — community table'],
] as const;

type Rejection = { filename: string; reason: 'type' | 'size' };

function isAllowedPhotoType(type: string): type is (typeof ALLOWED_PHOTO_MIME_TYPES)[number] {
  return (ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(type);
}

function describeRejections(rejected: Rejection[]): string[] {
  if (rejected.length === 0) return [];

  if (rejected.length <= 3) {
    return rejected.map(({ filename, reason }) =>
      reason === 'type'
        ? `"${filename}" wasn't added — only JPEG, PNG, WEBP, or GIF photos are supported.`
        : `"${filename}" wasn't added — photos must be 10MB or smaller.`
    );
  }

  const tooLarge = rejected.filter((r) => r.reason === 'size').length;
  const wrongType = rejected.filter((r) => r.reason === 'type').length;
  const parts: string[] = [];
  if (tooLarge > 0) parts.push(`${tooLarge} were too large (max 10MB)`);
  if (wrongType > 0) {
    parts.push(
      `${wrongType} ${wrongType === 1 ? 'has' : 'have'} an unsupported format (only JPEG, PNG, WEBP, GIF)`
    );
  }
  return [`${rejected.length} photos weren't added: ${parts.join(', ')}.`];
}

export default function EditorPage() {
  const { id } = useParams();
  const isEdit = !!id;

  const albumQuery = useAlbum(id);
  const createAlbum = useCreateAlbum();
  const updateAlbum = useUpdateAlbum(id ?? '');
  const deleteAlbum = useDeleteAlbum();

  const pagesQuery = usePages(id);
  const uploadPages = useUploadPages(id ?? '');
  const deletePage = useDeletePage(id ?? '');
  const [rejections, setRejections] = useState<string[]>([]);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string>();

  const mutation = isEdit ? updateAlbum : createAlbum;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<AlbumFormInput>({
    resolver: zodResolver(albumFormSchema),
    defaultValues: { title: '', description: '', visibility: 'private' },
  });

  // When editing, fill the form once the album arrives
  useEffect(() => {
    if (albumQuery.data) {
      const { title, description, visibility } = albumQuery.data;
      reset({ title, description, visibility });
    }
  }, [albumQuery.data, reset]);

  const visibility = watch('visibility');
  const busy = mutation.isPending || deleteAlbum.isPending;

  const onDelete = () => {
    if (!id) return;
    if (window.confirm('Delete this volume? Its pages and photos are removed permanently.')) {
      deleteAlbum.mutate(id);
    }
  };

  const onFilesSelected = (files: File[]) => {
    const accepted: File[] = [];
    const rejected: Rejection[] = [];

    for (const file of files) {
      if (!isAllowedPhotoType(file.type)) {
        rejected.push({ filename: file.name, reason: 'type' });
      } else if (file.size > MAX_PHOTO_SIZE_BYTES) {
        rejected.push({ filename: file.name, reason: 'size' });
      } else {
        accepted.push(file);
      }
    }

    setRejections(describeRejections(rejected));
    if (accepted.length > 0) uploadPages.mutate(accepted);
  };

  const onRemovePhoto = (photoId: string) => {
    if (!window.confirm("Remove this photo from the volume? This can't be undone.")) return;
    setDeletingPhotoId(photoId);
    deletePage.mutate(photoId, { onSettled: () => setDeletingPhotoId(undefined) });
  };

  return (
    <AppShell>
      <div className="lg:flex min-h-full">
        {/* Settings panel */}
        <aside className="lg:w-80 shrink-0 p-gutter lg:p-10 bg-surface-container-low border-b lg:border-b-0 lg:border-r border-outline-variant/40">
          <h2 className="font-display text-headline-md text-on-surface mb-8 border-b border-outline-variant pb-4">
            {isEdit ? 'Album Settings' : 'New Volume'}
          </h2>

          {isEdit && albumQuery.isLoading && (
            <p className="font-body italic text-on-surface-variant">Fetching the volume…</p>
          )}
          {isEdit && albumQuery.isError && (
            <p className="mb-6 px-4 py-3 bg-error-container text-on-error-container rounded-paper font-ui text-sm">
              {albumQuery.error.message}
            </p>
          )}
          {mutation.isError && (
            <p className="mb-6 px-4 py-3 bg-error-container text-on-error-container rounded-paper font-ui text-sm">
              {mutation.error.message}
            </p>
          )}
          {deleteAlbum.isError && (
            <p className="mb-6 px-4 py-3 bg-error-container text-on-error-container rounded-paper font-ui text-sm">
              {deleteAlbum.error.message}
            </p>
          )}

          <form id="album-form" onSubmit={handleSubmit((data) => mutation.mutate(data))} noValidate>
            <div className="flex flex-col gap-1 mb-8">
              <label className="font-ui text-ui-label uppercase text-on-surface-variant" htmlFor="album-title">
                Volume title
              </label>
              <input
                id="album-title"
                className="line-input w-full py-2 text-body-text"
                placeholder="Name this volume…"
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? 'album-title-error' : undefined}
                {...register('title')}
              />
              {errors.title && (
                <span id="album-title-error" role="alert" className="text-sm text-error font-ui mt-1">
                  {errors.title.message}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1 mb-10">
              <label className="font-ui text-ui-label uppercase text-on-surface-variant" htmlFor="album-desc">
                Description
              </label>
              <textarea
                id="album-desc"
                rows={3}
                className="line-input w-full py-2 text-body-text resize-none"
                placeholder="A few words about this story…"
                aria-invalid={!!errors.description}
                {...register('description')}
              />
              {errors.description && (
                <span role="alert" className="text-sm text-error font-ui mt-1">
                  {errors.description.message}
                </span>
              )}
            </div>

            <fieldset className="mb-10">
              <legend className="font-ui text-ui-label uppercase text-on-surface-variant mb-4">
                Privacy
              </legend>
              <div className="flex flex-col gap-3">
                {VISIBILITY_OPTIONS.map(([value, icon, label]) => (
                  <label
                    key={value}
                    className={`flex items-center gap-3 px-4 py-3 rounded-paper border cursor-pointer transition-colors font-body text-sm ${
                      visibility === value
                        ? 'border-secondary bg-secondary/5 text-primary'
                        : 'border-outline-variant/50 text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    <input type="radio" value={value} className="sr-only" {...register('visibility')} />
                    <Icon name={icon} className="text-lg" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          </form>

          {isEdit && (
            <button
              onClick={onDelete}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 font-ui text-ui-label uppercase text-error border border-error/40 px-4 py-3 rounded-paper hover:bg-error-container/40 transition-colors disabled:opacity-50"
            >
              <Icon name="delete" className="text-lg" />
              {deleteAlbum.isPending ? 'Deleting…' : 'Delete volume'}
            </button>
          )}
        </aside>

        {/* The craft table */}
        <section className="flex-1 p-gutter md:p-margin-edge flex items-center justify-center bg-surface-dim/40">
          <div className="w-full max-w-4xl">
            <div className="grid md:grid-cols-2 bg-surface rounded-card paper-depth overflow-hidden border border-outline-variant/30 min-h-120">
              <div className="relative p-8 md:p-12 border-b md:border-b-0 md:border-r border-outline-variant/40 flex items-center justify-center">
                <div className="absolute inset-y-0 right-0 w-2 bg-linear-to-l from-black/5 to-transparent hidden md:block" />
                <div className="text-center max-w-xs">
                  <h3 className="font-display text-2xl text-primary italic">
                    {watch('title') || 'Untitled Volume'}
                  </h3>
                  {watch('description') && (
                    <p className="font-body italic text-on-surface-variant mt-4">
                      {watch('description')}
                    </p>
                  )}
                  <p className="font-ui text-ui-label uppercase text-on-surface-variant/60 mt-8">
                    Cover preview
                  </p>
                </div>
                <span className="absolute bottom-4 left-8 font-body italic text-xs text-on-surface-variant/60">
                  cover
                </span>
              </div>

              <div className="relative p-8 md:p-12 flex items-center justify-center">
                <div className="absolute inset-y-0 left-0 w-2 bg-linear-to-r from-black/5 to-transparent hidden md:block" />
                <PagesPanel
                  locked={!isEdit}
                  photos={pagesQuery.data ?? []}
                  isUploading={uploadPages.isPending}
                  uploadError={
                    uploadPages.isError
                      ? uploadPages.error.message
                      : deletePage.isError
                        ? deletePage.error.message
                        : undefined
                  }
                  rejections={rejections}
                  deletingPhotoId={deletingPhotoId}
                  onFilesSelected={onFilesSelected}
                  onRemovePhoto={onRemovePhoto}
                  onDismissRejections={() => setRejections([])}
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end items-center gap-4">
              <button
                type="submit"
                form="album-form"
                disabled={busy || (isEdit && albumQuery.isLoading)}
                className="bg-secondary text-on-secondary px-8 py-3 rounded-paper font-ui text-ui-button shadow-md hover:opacity-90 active:translate-y-px transition-all flex items-center gap-2 disabled:opacity-60"
              >
                <Icon name="save" />
                {mutation.isPending
                  ? 'Saving…'
                  : isEdit
                    ? 'Save changes'
                    : 'Create volume'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
