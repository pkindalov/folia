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
import { circleFormSchema, PURPOSE_LABELS, PURPOSES, type CircleFormInput } from '../schemas';

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
  const isOwner = !!me && !!circle && circle.owner === me._id;
  const memberIds = new Set(circle?.members.map((member) => member.user) ?? []);

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    watch: watchEdit,
    formState: { errors: editErrors },
  } = useForm<CircleFormInput>({
    resolver: zodResolver(circleFormSchema),
    defaultValues: { name: '', purpose: 'family_lineage', privacy: 'private' },
  });

  // Fill the edit form whenever the circle loads or editing starts.
  useEffect(() => {
    if (circle) resetEdit({ name: circle.name, purpose: circle.purpose, privacy: circle.privacy });
  }, [circle, resetEdit]);

  const editPurpose = watchEdit('purpose');
  const editPrivacy = watchEdit('privacy');

  const onAddMember = (userId: string) => {
    addMember.mutate(userId, {
      onSuccess: () => {
        setSearch('');
        setDebouncedSearch('');
      },
    });
  };

  const onSaveEdit = (data: CircleFormInput) => {
    updateCircle.mutate(data, { onSuccess: () => setIsEditing(false) });
  };

  const onDelete = () => {
    if (!id) return;
    if (
      window.confirm('Delete this circle? Members will lose access to anything shared with it.')
    ) {
      deleteCircle.mutate(id, { onSuccess: () => navigate('/circles') });
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
                        aria-invalid={!!editErrors.name}
                        {...registerEdit('name')}
                      />
                      {editErrors.name && (
                        <span role="alert" className="text-sm text-error font-ui mt-1">
                          {editErrors.name.message}
                        </span>
                      )}
                    </div>

                    <fieldset>
                      <legend className="font-ui text-ui-label uppercase text-on-surface-variant mb-3">
                        Purpose
                      </legend>
                      <div className="grid grid-cols-2 gap-3">
                        {PURPOSES.map((value) => (
                          <label
                            key={value}
                            className={`flex items-center gap-3 p-3 rounded-paper border cursor-pointer transition-colors ${
                              editPurpose === value
                                ? 'border-secondary bg-secondary/5 text-primary'
                                : 'border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-low'
                            }`}
                          >
                            <input
                              type="radio"
                              value={value}
                              className="sr-only"
                              {...registerEdit('purpose')}
                            />
                            <span className="font-body text-sm">{PURPOSE_LABELS[value]}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <fieldset>
                      <legend className="font-ui text-ui-label uppercase text-on-surface-variant mb-3">
                        Privacy level
                      </legend>
                      <div className="flex gap-4">
                        <label
                          className={`flex-1 py-2 px-4 rounded-paper border font-ui text-ui-label uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                            editPrivacy === 'private'
                              ? 'border-primary bg-primary text-on-primary'
                              : 'border-outline-variant/50 hover:bg-surface-container-low'
                          }`}
                        >
                          <input
                            type="radio"
                            value="private"
                            className="sr-only"
                            {...registerEdit('privacy')}
                          />
                          <Icon name="lock" className="text-sm" filled={editPrivacy === 'private'} />
                          Private
                        </label>
                        <label
                          className={`flex-1 py-2 px-4 rounded-paper border font-ui text-ui-label uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                            editPrivacy === 'restricted'
                              ? 'border-primary bg-primary text-on-primary'
                              : 'border-outline-variant/50 hover:bg-surface-container-low'
                          }`}
                        >
                          <input
                            type="radio"
                            value="restricted"
                            className="sr-only"
                            {...registerEdit('privacy')}
                          />
                          <Icon
                            name="group"
                            className="text-sm"
                            filled={editPrivacy === 'restricted'}
                          />
                          Restricted
                        </label>
                      </div>
                    </fieldset>

                    {updateCircle.isError && (
                      <p role="alert" className="text-sm text-error font-ui">
                        {updateCircle.error.message}
                      </p>
                    )}

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
                      <span className="bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-paper font-ui text-[11px] uppercase tracking-wider">
                        {PURPOSE_LABELS[circle.purpose]}
                      </span>
                      {isOwner && (
                        <button
                          onClick={() => setIsEditing(true)}
                          aria-label="Edit circle"
                          className="text-on-surface-variant hover:text-secondary transition-colors"
                        >
                          <Icon name="edit" className="text-lg" />
                        </button>
                      )}
                    </div>
                    <h2 className="font-display text-display-lg text-primary mt-4">{circle.name}</h2>
                    <p className="font-body text-body-text text-on-surface-variant mt-2">
                      Owned by {circle.ownerUsername}
                    </p>
                  </>
                )}
              </div>

              {isOwner && (
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
                  {addMember.isError && (
                    <p role="alert" className="mt-2 text-sm text-error font-ui">
                      {addMember.error.message}
                    </p>
                  )}
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
                              onClick={() => onAddMember(user._id)}
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
                      const canRemove = isOwner || member.user === me?._id;
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
                              onClick={() => removeMember.mutate(member.user)}
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
                {removeMember.isError && (
                  <p role="alert" className="mt-2 text-sm text-error font-ui">
                    {removeMember.error.message}
                  </p>
                )}
              </div>

              {isOwner && (
                <div className="pt-6 border-t border-outline-variant/40">
                  <button
                    onClick={onDelete}
                    disabled={deleteCircle.isPending}
                    className="flex items-center gap-2 font-ui text-ui-label uppercase text-error border border-error/40 px-4 py-3 rounded-paper hover:bg-error-container/40 transition-colors disabled:opacity-50"
                  >
                    <Icon name="delete" className="text-lg" />
                    {deleteCircle.isPending ? 'Deleting…' : 'Delete circle'}
                  </button>
                  {deleteCircle.isError && (
                    <p role="alert" className="mt-2 text-sm text-error font-ui">
                      {deleteCircle.error.message}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
