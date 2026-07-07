import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../../components/AppShell';
import Icon from '../../../components/Icon';
import Pagination from '../../../components/Pagination';
import CreateCircleModal from '../components/CreateCircleModal';
import { useMe } from '../../auth';
import { useCircles, useMyInvites, useAcceptInvite, useDeclineInvite } from '../hooks';
import { PURPOSE_LABELS, type Circle, type CircleInvite } from '../schemas';

const MAX_VISIBLE_AVATARS = 3;

function MemberAvatars({ members }: { members: Circle['members'] }) {
  const visible = members.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = members.length - visible.length;

  return (
    <div className="flex -space-x-3">
      {visible.map((member) => (
        <span
          key={member.user}
          title={member.username}
          className="w-8 h-8 rounded-full border-2 border-surface-container-lowest bg-secondary text-on-secondary font-ui text-xs flex items-center justify-center"
        >
          {member.username.charAt(0).toUpperCase()}
        </span>
      ))}
      {overflow > 0 && (
        <span className="w-8 h-8 rounded-full border-2 border-surface-container-lowest bg-surface-container-highest text-on-surface-variant font-ui text-xs flex items-center justify-center">
          +{overflow}
        </span>
      )}
    </div>
  );
}

function CircleCard({ circle }: { circle: Circle }) {
  const navigate = useNavigate();
  const acceptedMembers = circle.members.filter((member) => member.status === 'accepted');
  const pendingCount = circle.members.length - acceptedMembers.length;

  return (
    <div className="bg-surface-container-lowest rounded-card p-8 border border-outline-variant/40 paper-depth flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-6">
          <span className="bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-paper font-ui text-[11px] uppercase tracking-wider">
            {PURPOSE_LABELS[circle.purpose]}
          </span>
          <span className="flex items-center gap-1 text-on-surface-variant text-xs font-ui uppercase">
            <Icon
              name={circle.privacy === 'private' ? 'lock' : 'group'}
              className="text-sm"
              filled={circle.privacy === 'private'}
            />
            {circle.privacy === 'private' ? 'Private' : 'Restricted'}
          </span>
        </div>
        <h3 className="font-display text-headline-md text-primary mb-6">{circle.name}</h3>
      </div>
      <div className="border-b border-outline-variant/40 pb-4 mb-4 flex justify-between items-center">
        <MemberAvatars members={acceptedMembers} />
        <div className="text-right">
          <span className="font-ui text-ui-label text-on-surface-variant block">
            {acceptedMembers.length} {acceptedMembers.length === 1 ? 'member' : 'members'}
          </span>
          {pendingCount > 0 && (
            <span className="font-ui text-[10px] text-on-surface-variant/70 uppercase tracking-wider">
              {pendingCount} invited
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => navigate(`/circles/${circle._id}`)}
        className="w-full py-2 rounded-paper border border-primary text-primary font-ui text-ui-label uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-colors"
      >
        Manage Circle
      </button>
    </div>
  );
}

function InviteCard({ invite }: { invite: CircleInvite }) {
  const { data: me } = useMe();
  const acceptInvite = useAcceptInvite();
  const declineInvite = useDeclineInvite();
  const busy = acceptInvite.isPending || declineInvite.isPending;

  const onAccept = () => {
    if (me) acceptInvite.mutate({ circleId: invite._id, userId: me._id });
  };
  const onDecline = () => {
    if (me) declineInvite.mutate({ circleId: invite._id, userId: me._id });
  };

  return (
    <div className="bg-surface-container-low rounded-card p-6 border border-outline-variant/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <span className="bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-paper font-ui text-[11px] uppercase tracking-wider">
          {PURPOSE_LABELS[invite.purpose]}
        </span>
        <h3 className="font-display text-headline-md text-primary mt-2">{invite.name}</h3>
        <p className="font-body text-sm text-on-surface-variant mt-1">
          Invited by {invite.ownerUsername}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onAccept}
          disabled={busy}
          className="bg-primary text-on-primary px-5 py-2 rounded-paper font-ui text-ui-label uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-60"
        >
          {acceptInvite.isPending ? 'Accepting…' : 'Accept'}
        </button>
        <button
          onClick={onDecline}
          disabled={busy}
          className="px-5 py-2 rounded-paper border border-outline-variant/50 font-ui text-ui-label uppercase tracking-widest hover:bg-surface-container-low transition-colors disabled:opacity-60"
        >
          {declineInvite.isPending ? 'Declining…' : 'Decline'}
        </button>
      </div>
    </div>
  );
}

export default function CirclesPage() {
  const [page, setPage] = useState(1);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const { data, isLoading, isError, error } = useCircles(page);
  const invitesQuery = useMyInvites(1);
  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <AppShell>
      <div className="p-gutter md:p-margin-edge">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 border-b border-outline-variant pb-6">
            <h2 className="font-display text-display-lg text-primary mb-2">Manage My Circles</h2>
            <p className="font-body text-body-text text-on-surface-variant max-w-2xl">
              Organize your contributors into intimate circles to curate the shared history of
              your family, colleagues, and lifelong friends.
            </p>
          </div>

          {invitesQuery.data && invitesQuery.data.total > 0 && (
            <div className="mb-12">
              <h3 className="font-ui text-ui-label uppercase text-on-surface-variant mb-4">
                Circle Invitations
              </h3>
              <div className="flex flex-col gap-4">
                {invitesQuery.data.invites.map((invite) => (
                  <InviteCard key={invite._id} invite={invite} />
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <p className="font-body italic text-on-surface-variant">Gathering your circles…</p>
          )}
          {isError && (
            <p className="px-4 py-3 bg-error-container text-on-error-container rounded-paper font-ui text-sm inline-block">
              {error.message}
            </p>
          )}

          {data && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {page === 1 && (
                <button
                  onClick={() => setCreateOpen(true)}
                  className="group border-2 border-dashed border-outline-variant/60 rounded-card hover:bg-surface-container-low hover:border-secondary transition-all p-10 flex flex-col items-center justify-center text-center gap-4"
                >
                  <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-on-primary group-hover:scale-110 transition-transform">
                    <Icon name="add" className="text-4xl" />
                  </div>
                  <div>
                    <h3 className="font-display text-headline-md text-primary">
                      Create New Circle
                    </h3>
                    <p className="font-ui text-[11px] text-on-surface-variant uppercase tracking-widest mt-2">
                      Initialize a new archive
                    </p>
                  </div>
                </button>
              )}

              {data.circles.map((circle) => (
                <CircleCard key={circle._id} circle={circle} />
              ))}

              {data.total === 0 && page === 1 && (
                <div className="col-span-full sm:col-span-1 lg:col-span-2 flex items-center">
                  <p className="font-body italic text-on-surface-variant text-body-text">
                    You haven't created any circles yet. Start one to organize who sees your
                    shared albums.
                  </p>
                </div>
              )}
            </div>
          )}

          {data && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
        </div>
      </div>

      <CreateCircleModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} />
    </AppShell>
  );
}
