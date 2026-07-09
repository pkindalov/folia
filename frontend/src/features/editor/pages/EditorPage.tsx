import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import PagesPanel from '../components/PagesPanel';
import { useMe } from '../../auth';
import { useCircle, useCirclesInfinite } from '../../circles';
import {
  albumFormSchema,
  type AlbumFormInput,
  useAlbum,
  useCreateAlbum,
  useUpdateAlbum,
  useDeleteAlbum,
  useArchiveAlbum,
  usePages,
  useUploadPages,
  useDeletePage,
  useUpdatePageCaption,
  useSetCoverPhoto,
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_SIZE_BYTES,
} from '../../flipbooks';

const VISIBILITY_OPTIONS = [
  ['private', 'lock', 'Private — only you'],
  ['shared', 'group', 'Shared — signed-in users, or a circle'],
  ['public', 'public', 'Public — community table'],
] as const;

type Rejection = { filename: string; reason: 'type' | 'size' };

function isAllowedPhotoType(type: string): type is (typeof ALLOWED_PHOTO_MIME_TYPES)[number] {
  return (ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(type);
}

function withId(ids: Set<string>, id: string): Set<string> {
  return new Set(ids).add(id);
}

function withoutId(ids: Set<string>, id: string): Set<string> {
  const next = new Set(ids);
  next.delete(id);
  return next;
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
  const isEdit = id !== undefined;

  const albumQuery = useAlbum(id);
  const createAlbum = useCreateAlbum();
  const updateAlbum = useUpdateAlbum(id ?? '');
  const deleteAlbum = useDeleteAlbum();
  const archiveAlbum = useArchiveAlbum(id ?? '');
  const { data: me } = useMe();
  const circlesQuery = useCirclesInfinite();
  // The circle the album is already restricted to might not be on the first
  // page of the general list (or might have fallen off it) — fetch it
  // directly so the picker never silently drops the album's current state.
  const assignedCircleQuery = useCircle(albumQuery.data?.sharedWithCircle ?? undefined);

  // Pages are fetched over time while sorted by a mutable field (updatedAt),
  // so a circle updated between "page 1" and "load more" can shift and be
  // returned on both pages — dedupe by id rather than showing it twice.
  const circlesFromList = Array.from(
    new Map(
      (circlesQuery.data?.pages.flatMap((page) => page.circles) ?? []).map((circle) => [
        circle._id,
        circle,
      ])
    ).values()
  );
  const ownedCirclesFromList = circlesFromList.filter((circle) => circle.owner === me?._id);
  const assignedCircle = assignedCircleQuery.data;
  // Include the assigned circle even when the requester doesn't own it (an
  // Admin editing someone else's album) — otherwise the <select> has no
  // <option> for the album's actual value and silently submits a different
  // one (typically null) on the next unrelated save, quietly widening access.
  const assignedCircleIsMissing =
    assignedCircle !== undefined &&
    !ownedCirclesFromList.some((circle) => circle._id === assignedCircle._id);
  const circleOptions = assignedCircleIsMissing
    ? [...ownedCirclesFromList, assignedCircle]
    : ownedCirclesFromList;

  const pagesQuery = usePages(id);
  const uploadPages = useUploadPages(id ?? '');
  const deletePage = useDeletePage(id ?? '');
  const updateCaption = useUpdatePageCaption(id ?? '');
  const setCoverPhoto = useSetCoverPhoto(id ?? '');
  const [rejections, setRejections] = useState<string[]>([]);
  // Sets, not single ids — several photos can each have their own in-flight
  // delete/cover/caption request at once, and one photo settling must not
  // clear another photo's still-pending busy state.
  const [deletingPhotoIds, setDeletingPhotoIds] = useState<Set<string>>(new Set());
  const [settingCoverPhotoIds, setSettingCoverPhotoIds] = useState<Set<string>>(new Set());
  const [savingCaptionPhotoIds, setSavingCaptionPhotoIds] = useState<Set<string>>(new Set());

  // The cover is whichever photo was explicitly chosen; absent that, the
  // earliest-uploaded one — pagesQuery is already sorted oldest-first.
  const coverPhotoId = albumQuery.data?.coverPage ?? pagesQuery.data?.[0]?._id;

  const mutation = isEdit ? updateAlbum : createAlbum;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<AlbumFormInput>({
    resolver: zodResolver(albumFormSchema),
    defaultValues: { title: '', description: '', visibility: 'private', sharedWithCircle: null },
  });

  // When editing, fill the form once the album arrives
  useEffect(() => {
    if (albumQuery.data) {
      const { title, description, visibility, sharedWithCircle } = albumQuery.data;
      reset({ title, description, visibility, sharedWithCircle: sharedWithCircle ?? null });
    }
  }, [albumQuery.data, reset]);

  const visibility = watch('visibility');
  const busy = mutation.isPending || deleteAlbum.isPending || archiveAlbum.isPending;

  const onDelete = () => {
    if (!id) return;
    if (window.confirm('Delete this volume? Its pages and photos are removed permanently.')) {
      deleteAlbum.mutate(id);
    }
  };

  const onToggleArchived = () => {
    archiveAlbum.mutate(!albumQuery.data?.archived);
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
    setDeletingPhotoIds((prev) => withId(prev, photoId));
    deletePage.mutate(photoId, {
      onSettled: () => setDeletingPhotoIds((prev) => withoutId(prev, photoId)),
    });
  };

  const onCaptionChange = (photoId: string, caption: string) => {
    setSavingCaptionPhotoIds((prev) => withId(prev, photoId));
    updateCaption.mutate(
      { pageId: photoId, caption },
      { onSettled: () => setSavingCaptionPhotoIds((prev) => withoutId(prev, photoId)) }
    );
  };

  const onSetCoverPhoto = (photoId: string) => {
    setSettingCoverPhotoIds((prev) => withId(prev, photoId));
    setCoverPhoto.mutate(photoId, {
      onSettled: () => setSettingCoverPhotoIds((prev) => withoutId(prev, photoId)),
    });
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
          {archiveAlbum.isError && (
            <p className="mb-6 px-4 py-3 bg-error-container text-on-error-container rounded-paper font-ui text-sm">
              {archiveAlbum.error.message}
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
                aria-invalid={errors.title !== undefined}
                aria-describedby={errors.title !== undefined ? 'album-title-error' : undefined}
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
                aria-invalid={errors.description !== undefined}
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

            {visibility === 'shared' && (
              <fieldset className="mb-10">
                <legend className="font-ui text-ui-label uppercase text-on-surface-variant mb-4">
                  Share with circle
                </legend>
                {circleOptions.length === 0 ? (
                  <p className="font-body italic text-sm text-on-surface-variant">
                    You don't have any circles yet.{' '}
                    <Link to="/circles" className="underline hover:text-secondary">
                      Create one
                    </Link>{' '}
                    to restrict who can see this album.
                  </p>
                ) : (
                  <>
                    <select
                      className="line-input w-full py-2 text-body-text"
                      {...register('sharedWithCircle', {
                        setValueAs: (value) => (value === '' ? null : value),
                      })}
                    >
                      <option value="">Open to any signed-in user</option>
                      {circleOptions.map((circle) => (
                        <option key={circle._id} value={circle._id}>
                          {circle.name}
                        </option>
                      ))}
                    </select>
                    {circlesQuery.hasNextPage && (
                      <button
                        type="button"
                        onClick={() => circlesQuery.fetchNextPage()}
                        disabled={circlesQuery.isFetchingNextPage}
                        className="mt-2 font-ui text-ui-label uppercase text-xs text-secondary hover:text-primary disabled:opacity-50 transition-colors"
                      >
                        {circlesQuery.isFetchingNextPage ? 'Loading…' : 'Load more circles'}
                      </button>
                    )}
                  </>
                )}
              </fieldset>
            )}
          </form>

          {isEdit && (
            <div className="flex flex-col gap-3">
              <button
                onClick={onToggleArchived}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 font-ui text-ui-label uppercase text-on-surface-variant border border-outline-variant/50 px-4 py-3 rounded-paper hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                <Icon name={albumQuery.data?.archived ? 'unarchive' : 'archive'} className="text-lg" />
                {archiveAlbum.isPending
                  ? 'Saving…'
                  : albumQuery.data?.archived
                    ? 'Restore from archive'
                    : 'Archive volume'}
              </button>
              <button
                onClick={onDelete}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 font-ui text-ui-label uppercase text-error border border-error/40 px-4 py-3 rounded-paper hover:bg-error-container/40 transition-colors disabled:opacity-50"
              >
                <Icon name="delete" className="text-lg" />
                {deleteAlbum.isPending ? 'Deleting…' : 'Delete volume'}
              </button>
            </div>
          )}
        </aside>

        {/* The craft table */}
        <section className="flex-1 p-gutter md:p-margin-edge flex items-center justify-center bg-surface-dim/40">
          <div className="w-full max-w-4xl">
            <div className="grid md:grid-cols-2 bg-surface rounded-card paper-depth overflow-hidden border border-outline-variant/30 min-h-120">
              <div className="relative p-8 md:p-12 border-b md:border-b-0 md:border-r border-outline-variant/40 flex items-center justify-center overflow-hidden">
                {albumQuery.data?.coverImage && (
                  <>
                    <img
                      src={albumQuery.data.coverImage}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40" />
                  </>
                )}
                <div className="absolute inset-y-0 right-0 w-2 bg-linear-to-l from-black/5 to-transparent hidden md:block" />
                <div
                  className={`relative text-center max-w-xs ${albumQuery.data?.coverImage ? 'text-white' : 'text-primary'}`}
                >
                  <h3 className="font-display text-2xl italic">{watch('title') || 'Untitled Volume'}</h3>
                  {watch('description') && (
                    <p
                      className={`font-body italic mt-4 ${albumQuery.data?.coverImage ? 'text-white/80' : 'text-on-surface-variant'}`}
                    >
                      {watch('description')}
                    </p>
                  )}
                  {!albumQuery.data?.coverImage && (
                    <p className="font-ui text-ui-label uppercase text-on-surface-variant/60 mt-8">
                      Cover preview
                    </p>
                  )}
                </div>
                <span
                  className={`absolute bottom-4 left-8 font-body italic text-xs ${albumQuery.data?.coverImage ? 'text-white/70' : 'text-on-surface-variant/60'}`}
                >
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
                        : updateCaption.isError
                          ? updateCaption.error.message
                          : setCoverPhoto.isError
                            ? setCoverPhoto.error.message
                            : undefined
                  }
                  rejections={rejections}
                  deletingPhotoIds={deletingPhotoIds}
                  coverPhotoId={coverPhotoId}
                  settingCoverPhotoIds={settingCoverPhotoIds}
                  savingCaptionPhotoIds={savingCaptionPhotoIds}
                  onFilesSelected={onFilesSelected}
                  onRemovePhoto={onRemovePhoto}
                  onSetCoverPhoto={onSetCoverPhoto}
                  onDismissRejections={() => setRejections([])}
                  onCaptionChange={onCaptionChange}
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
