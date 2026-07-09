import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import { useMe } from '../../auth';
import {
  useCircle,
  useAddCircleMember,
  useRemoveCircleMember,
  useDeleteCircle,
  useUpdateCircle,
  useSearchUsers,
} from '../hooks';
import { circleFormSchema, MAX_CIRCLE_DESCRIPTION_LENGTH, type CircleFormInput } from '../schemas';
import { toast } from '../../../lib/toast';

export default function CircleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const circleQuery = useCircle(id);
  const addMember = useAddCircleMember(id ?? '');
  const removeMember = useRemoveCircleMember(id ?? '');
  const deleteCircle = useDeleteCircle();
  const updateCircle = useUpdateCircle(id ?? '');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchQuery = useSearchUsers(debouncedSearch);
  const [isEditing, setIsEditing] = useState(false);

  // Debounce the search-as-you-type input so ordinary fast typing doesn't
  // fire a query (and burn the search rate limit) on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const circle = circleQuery.data;
  // The backend already lets an Admin manage a circle they don't own
  // (isOwnerOrAdmin) — mirror that here so the controls aren't hidden from
  // an Admin who's landed on someone else's circle.
  const canManage =
    me !== undefined &&
    circle !== undefined &&
    (circle.owner === me._id || me.roles.includes('Admin'));
  const memberIds = new Set(circle?.members.map((member) => member.user) ?? []);

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    watch: watchEdit,
    formState: { errors: editErrors },
  } = useForm<CircleFormInput>({
    resolver: zodResolver(circleFormSchema),
    defaultValues: { name: '', description: '' },
  });

  // Fill the edit form whenever the circle loads or editing starts.
  useEffect(() => {
    if (circle) resetEdit({ name: circle.name, description: circle.description });
  }, [circle, resetEdit]);

  const editDescriptionLength = watchEdit('description').trim().length;

  const onAddMember = (userId: string, username: string) => {
    addMember.mutate(userId, {
      onSuccess: () => {
        toast.success(`Invited ${username}.`);
        setSearch('');
        setDebouncedSearch('');
      },
      onError: (error) => toast.error(error.message),
    });
  };

  const onSaveEdit = (data: CircleFormInput) => {
    updateCircle.mutate(data, {
      onSuccess: () => {
        toast.success('Circle updated.');
        setIsEditing(false);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  const onRemoveMember = (userId: string, username: string, isPendingInvite: boolean) => {
    removeMember.mutate(userId, {
      onSuccess: () =>
        toast.success(isPendingInvite ? `Cancelled invite to ${username}.` : `Removed ${username}.`),
      onError: (error) => toast.error(error.message),
    });
  };

  const onDelete = () => {
    if (!id) return;
    if (
      window.confirm('Delete this circle? Members will lose access to anything shared with it.')
    ) {
      deleteCircle.mutate(id, {
        onSuccess: () => {
          toast.success('Circle deleted.');
          navigate('/circles');
        },
        onError: (error) => toast.error(error.message),
      });
    }
  };

  return (
    <AppShell>
      <div className="p-gutter md:p-margin-edge">
        <div className="max-w-3xl mx-auto">
          {circleQuery.isLoading && (
            <p className="font-body italic text-on-surface-variant">Opening the circle…</p>
          )}
          {circleQuery.isError && (
            <p className="px-4 py-3 bg-error-container text-on-error-container rounded-paper font-ui text-sm inline-block">
              {circleQuery.error.message}
            </p>
          )}

          {circle && (
            <>
              <div className="mb-10 border-b border-outline-variant pb-6">
                {isEditing ? (
                  <form onSubmit={handleEditSubmit(onSaveEdit)} noValidate className="flex flex-col gap-6">
                    <div className="flex flex-col gap-1">
                      <label
                        className="font-ui text-ui-label uppercase text-on-surface-variant"
                        htmlFor="edit-circle-name"
                      >
                        Circle name
                      </label>
                      <input
                        id="edit-circle-name"
                        className="line-input w-full py-2 text-headline-md font-display"
                        aria-invalid={editErrors.name !== undefined}
                        {...registerEdit('name')}
                      />
                      {editErrors.name && (
                        <span role="alert" className="text-sm text-error font-ui mt-1">
                          {editErrors.name.message}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        className="font-ui text-ui-label uppercase text-on-surface-variant"
                        htmlFor="edit-circle-description"
                      >
                        Description
                      </label>
                      <textarea
                        id="edit-circle-description"
                        rows={3}
                        className="line-input w-full py-2 text-body-text resize-none"
                        placeholder="What's this circle for?"
                        aria-invalid={editErrors.description !== undefined}
                        {...registerEdit('description')}
                      />
                      <div className="flex justify-between items-start mt-1">
                        {editErrors.description ? (
                          <span role="alert" className="text-sm text-error font-ui">
                            {editErrors.description.message}
                          </span>
                        ) : (
                          <span />
                        )}
                        <span
                          className={`font-ui text-[11px] ${
                            editDescriptionLength > MAX_CIRCLE_DESCRIPTION_LENGTH
                              ? 'text-error'
                              : 'text-on-surface-variant'
                          }`}
                        >
                          {editDescriptionLength}/{MAX_CIRCLE_DESCRIPTION_LENGTH}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={updateCircle.isPending}
                        className="bg-primary text-on-primary py-2 px-6 rounded-paper font-ui text-ui-label uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-60"
                      >
                        {updateCircle.isPending ? 'Saving…' : 'Save changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="py-2 px-6 rounded-paper border border-outline-variant/50 font-ui text-ui-label uppercase tracking-widest hover:bg-surface-container-low transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <h2 className="font-display text-display-lg text-primary">{circle.name}</h2>
                      {canManage && (
                        <button
                          onClick={() => setIsEditing(true)}
                          aria-label="Edit circle"
                          className="text-on-surface-variant hover:text-secondary transition-colors"
                        >
                          <Icon name="edit" className="text-lg" />
                        </button>
                      )}
                    </div>
                    <p className="font-body text-body-text text-on-surface-variant mt-2">
                      Owned by {circle.ownerUsername}
                    </p>
                    {circle.description && (
                      <p className="font-body text-body-text text-on-surface-variant mt-2">
                        {circle.description}
                      </p>
                    )}
                  </>
                )}
              </div>

              {canManage && (
                <div className="mb-10">
                  <h3 className="font-ui text-ui-label uppercase text-on-surface-variant mb-3">
                    Invite a member
                  </h3>
                  <p className="font-body italic text-sm text-on-surface-variant mb-3">
                    They'll need to accept before they can see anything shared with this circle.
                  </p>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by username…"
                    className="line-input w-full py-2 text-body-text"
                  />
                  {searchQuery.data && searchQuery.data.length > 0 && (
                    <ul className="mt-3 border border-outline-variant/40 rounded-paper divide-y divide-outline-variant/40">
                      {searchQuery.data.map((user) => {
                        const alreadyInvited = memberIds.has(user._id);
                        return (
                          <li
                            key={user._id}
                            className="flex items-center justify-between px-4 py-3"
                          >
                            <span className="font-body">{user.username}</span>
                            <button
                              onClick={() => onAddMember(user._id, user.username)}
                              disabled={alreadyInvited || addMember.isPending}
                              className="font-ui text-ui-label uppercase text-secondary hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {alreadyInvited ? 'Invited' : 'Invite'}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {debouncedSearch.trim().length >= 2 && searchQuery.data?.length === 0 && (
                    <p className="mt-3 font-body italic text-on-surface-variant text-sm">
                      No users found.
                    </p>
                  )}
                </div>
              )}

              <div className="mb-10">
                <h3 className="font-ui text-ui-label uppercase text-on-surface-variant mb-3">
                  {circle.members.length} {circle.members.length === 1 ? 'Member' : 'Members'}
                </h3>
                {circle.members.length === 0 ? (
                  <p className="font-body italic text-on-surface-variant">
                    No members yet — search above to invite your first one.
                  </p>
                ) : (
                  <ul className="border border-outline-variant/40 rounded-paper divide-y divide-outline-variant/40">
                    {circle.members.map((member) => {
                      const canRemove = canManage || member.user === me?._id;
                      const isPending = member.status === 'pending';
                      return (
                        <li
                          key={member.user}
                          className="flex items-center justify-between px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-secondary text-on-secondary font-ui text-xs flex items-center justify-center">
                              {member.username.charAt(0).toUpperCase()}
                            </span>
                            <span className="font-body">{member.username}</span>
                            {isPending && (
                              <span className="font-ui text-[10px] uppercase tracking-wider text-on-surface-variant/70 border border-outline-variant/50 rounded-paper px-2 py-0.5">
                                Pending
                              </span>
                            )}
                          </div>
                          {canRemove && (
                            <button
                              onClick={() => onRemoveMember(member.user, member.username, isPending)}
                              disabled={removeMember.isPending}
                              aria-label={
                                isPending ? `Cancel invite to ${member.username}` : `Remove ${member.username}`
                              }
                              className="text-on-surface-variant hover:text-error transition-colors disabled:opacity-40"
                            >
                              <Icon name="close" className="text-lg" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {canManage && (
                <div className="pt-6 border-t border-outline-variant/40">
                  <button
                    onClick={onDelete}
                    disabled={deleteCircle.isPending}
                    className="flex items-center gap-2 font-ui text-ui-label uppercase text-error border border-error/40 px-4 py-3 rounded-paper hover:bg-error-container/40 transition-colors disabled:opacity-50"
                  >
                    <Icon name="delete" className="text-lg" />
                    {deleteCircle.isPending ? 'Deleting…' : 'Delete circle'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
