const mongoose = require('mongoose');
const Circle = require('../data/Circle');
const User = require('../data/User');
const Album = require('../data/Album');
const Notification = require('../data/Notification');
const errorHandler = require('../utilities/error-handler');
const {
  isNonEmptyString,
  parsePage,
  DELETED_USER_LABEL,
  isOwnerOrAdmin,
  circleRecipientIds,
} = require('../utilities/controller-helpers');

const { MAX_MEMBERS } = Circle;
const INVITES_PAGE_SIZE = 12;
const CIRCLES_PAGE_SIZE = 12;

// Returns an error message, or null when the input is valid.
// For updates, fields that are undefined are simply skipped.
function validateCircleInput(body, { partial = false } = {}) {
  const { name, description } = body || {};

  if (!partial || name !== undefined) {
    if (!isNonEmptyString(name)) return 'name is required';
    if (name.trim().length > 80) return 'name must be at most 80 characters';
  }
  if (description !== undefined) {
    if (typeof description !== 'string') return 'description must be a string';
    if (description.trim().length > 300) return 'description must be at most 300 characters';
  }
  return null;
}

// Distinct from isOwnerOrMember on the model: this checks whether a specific
// *target* user (not necessarily the requester) is already a member — used
// to guard against double-adding, not to authorize a view.
function isMember(circle, user) {
  return circle.members.some((member) => member.user.toString() === user._id.toString());
}

function canView(circle, user) {
  return isOwnerOrAdmin(circle, user) || circle.isOwnerOrMember(user._id);
}

// Attaches usernames to the owner and each member, without changing the
// stored shape — a single User lookup covers everyone on the circle.
function withUsernames(circle) {
  const ids = [circle.owner.toString(), ...circle.members.map((m) => m.user.toString())];
  const uniqueIds = [...new Set(ids)];

  return User.find({ _id: { $in: uniqueIds } }, 'username').then((users) => {
    const usernameById = new Map(users.map((user) => [user._id.toString(), user.username]));
    const json = circle.toJSON();
    return {
      ...json,
      ownerUsername: usernameById.get(circle.owner.toString()) ?? DELETED_USER_LABEL,
      // invitedBy is server-side bookkeeping (used to route accept/decline
      // notifications back to the inviter) — not meant for any client to see.
      members: json.members.map(({ invitedBy, ...member }) => ({
        ...member,
        username: usernameById.get(member.user.toString()) ?? DELETED_USER_LABEL,
      })),
    };
  });
}

// Fire-and-forget: notification bookkeeping must never turn an otherwise
// successful circle-membership response into a failure, so every call site
// below logs and swallows rather than propagating into the response chain.
function notifyCircleInvite({ circleId, circleName, actorUsername, actorId, recipientId }) {
  Notification.create({
    recipient: recipientId,
    type: 'circle_invite',
    circle: circleId,
    circleName,
    actorUsername,
    actor: actorId,
  })
    .then(() => Notification.pruneExcessForRecipient(recipientId))
    .catch((err) => console.error('Failed to create/prune circle-invite notification', err));
}

// Notifies whoever sent a specific invite that the invitee accepted or
// declined it. Silently a no-op (not an error) when invitedBy is missing
// (an invite sent before this field existed) or equals the person acting —
// there is no inviter to notify, or notifying yourself would be meaningless.
// Wrapped in a Promise so even the synchronous guard checks share the same
// fire-and-forget contract as notifyCircleInvite above: nothing in here can
// ever propagate into the caller's response chain.
function notifyCircleInviteResponse({ type, circleId, circleName, invitedBy, actingUser }) {
  Promise.resolve()
    .then(() => {
      if (!invitedBy) return null;
      if (invitedBy.toString() === actingUser._id.toString()) return null;

      return Notification.create({
        recipient: invitedBy,
        type,
        circle: circleId,
        circleName,
        actorUsername: actingUser.username,
        actor: actingUser._id,
      }).then(() => Notification.pruneExcessForRecipient(invitedBy));
    })
    .catch((err) => console.error('Failed to create/prune circle-invite-response notification', err));
}

// Notifies every accepted member (and the owner, if someone else — e.g. an
// Admin — is the one deleting) that the circle is gone. Excludes whoever
// performed the deletion; they don't need telling. Fire-and-forget, same
// contract as notifyCircleInviteResponse above: wrapped in a Promise so
// even the synchronous recipient-set computation can never propagate into
// the caller's response chain, and recipientIds are independent, so one
// failed create doesn't stop the others from going out.
function notifyCircleDeleted({ circle, circleName, actorUsername, actorId }) {
  Promise.resolve()
    .then(() => {
      const recipientIds = circleRecipientIds(circle, actorId);

      return Promise.all(
        recipientIds.map((recipientId) =>
          Notification.create({
            recipient: recipientId,
            type: 'circle_deleted',
            circle: circle._id,
            circleName,
            actorUsername,
            actor: actorId,
          }).then(() => Notification.pruneExcessForRecipient(recipientId))
        )
      );
    })
    .catch((err) => console.error('Failed to create/prune circle-deleted notifications', err));
}

function markCircleInviteRead({ circleId, recipientId }) {
  Notification.updateMany(
    { recipient: recipientId, circle: circleId, type: 'circle_invite', read: false },
    { $set: { read: true, readAt: new Date() } }
  ).catch((err) => console.error('Failed to mark circle-invite notification read', err));
}

// Used when the circle itself stops existing (deleted, or every pending
// invite on it revoked) — there is no longer a single recipient to scope to,
// so every still-unread invite notification for the circle is cleared.
function markAllCircleInvitesRead(circleId) {
  Notification.updateMany(
    { circle: circleId, type: 'circle_invite', read: false },
    { $set: { read: true, readAt: new Date() } }
  ).catch((err) => console.error('Failed to mark circle-invite notifications read', err));
}

module.exports = {
  list: (req, res) => {
    const page = parsePage(req.query);
    // A pending (not-yet-accepted) invitee must not show up here: this list
    // returns the full member array, and isOwnerOrMember/canView already
    // treat pending members as having no access — surfacing the circle here
    // would both leak its member list to them and dead-end into a 403 the
    // moment they open it. listInvites is where pending invites belong.
    const filter = {
      $or: [
        { owner: req.user._id },
        { members: { $elemMatch: { user: req.user._id, status: 'accepted' } } },
      ],
    };

    Promise.all([
      Circle.countDocuments(filter),
      Circle.find(filter)
        .sort('-updatedAt')
        .skip((page - 1) * CIRCLES_PAGE_SIZE)
        .limit(CIRCLES_PAGE_SIZE),
    ])
      .then(([total, circles]) =>
        Promise.all(circles.map(withUsernames)).then((circles) => ({ total, circles }))
      )
      .then(({ total, circles }) =>
        res.json({ circles, total, page, limit: CIRCLES_PAGE_SIZE })
      )
      .catch(() => res.status(500).json({ error: 'Failed to load circles' }));
  },

  getOne: (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Circle not found' });
    }

    Circle.findById(id)
      .then((circle) => {
        if (!circle) return res.status(404).json({ error: 'Circle not found' });
        if (!canView(circle, req.user)) {
          return res.status(403).json({ error: 'You do not have access to this circle' });
        }
        return withUsernames(circle).then((circle) => res.json({ circle }));
      })
      .catch(() => res.status(500).json({ error: 'Failed to load circle' }));
  },

  create: (req, res) => {
    const error = validateCircleInput(req.body);
    if (error) return res.status(400).json({ error });

    const { name, description } = req.body;

    Circle.create({
      name: name.trim(),
      description: (description ?? '').trim(),
      owner: req.user._id,
      members: [],
    })
      .then((circle) => withUsernames(circle).then((circle) => res.status(201).json({ circle })))
      .catch((err) => res.status(400).json({ error: errorHandler.handleMongooseError(err) }));
  },

  update: (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Circle not found' });
    }

    const error = validateCircleInput(req.body, { partial: true });
    if (error) return res.status(400).json({ error });

    Circle.findById(id)
      .then((circle) => {
        if (!circle) return res.status(404).json({ error: 'Circle not found' });
        if (!isOwnerOrAdmin(circle, req.user)) {
          return res.status(403).json({ error: 'You do not own this circle' });
        }

        const { name, description } = req.body;
        if (name !== undefined) circle.name = name.trim();
        if (description !== undefined) circle.description = description.trim();

        return circle
          .save()
          .then((saved) => withUsernames(saved).then((circle) => res.json({ circle })))
          .catch((err) => res.status(400).json({ error: errorHandler.handleMongooseError(err) }));
      })
      .catch(() => res.status(500).json({ error: 'Failed to update circle' }));
  },

  remove: (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Circle not found' });
    }

    Circle.findById(id)
      .then((circle) => {
        if (!circle) return res.status(404).json({ error: 'Circle not found' });
        if (!isOwnerOrAdmin(circle, req.user)) {
          return res.status(403).json({ error: 'You do not own this circle' });
        }
        // Unshare albums *before* deleting the circle (not after): these are
        // two separate writes with no surrounding transaction, so if the
        // second one failed after the first had already succeeded, an album
        // would be left pointing at a deleted circle. Doing it in this order
        // means the circle is only ever deleted once no album still
        // references it — if the update fails, the circle (and its
        // now-still-valid reference) simply survives for a retry.
        return Album.updateMany(
          { sharedWithCircle: id },
          { sharedWithCircle: null, visibility: 'private' }
        )
          .then(() =>
            // Atomic find-and-delete, not circle.deleteOne(): two concurrent
            // requests can both pass the read/permission check above before
            // either deletes, and Model#deleteOne() doesn't error when
            // nothing matches — so without this, both would fall through to
            // the block below and double-fire markAllCircleInvitesRead and
            // notifyCircleDeleted. findOneAndDelete only ever actually
            // removes the document once; whichever request loses the race
            // gets null back and skips those side effects, since the
            // winning request already handled them.
            //
            // Unsharing already succeeded by this point, so a failure here must
            // be reported differently: the circle survives, but its albums are
            // no longer shared with it, and a generic "failed to delete" message
            // would hide that from the caller.
            Circle.findOneAndDelete({ _id: id }).catch(() =>
              Promise.reject(new Error('DELETE_AFTER_UNSHARE_FAILED'))
            )
          )
          .then((deletedCircle) => {
            if (deletedCircle) {
              markAllCircleInvitesRead(id);
              notifyCircleDeleted({
                circle: deletedCircle,
                circleName: deletedCircle.name,
                actorUsername: req.user.username,
                actorId: req.user._id.toString(),
              });
            }
            return res.json({ deleted: true });
          });
      })
      .catch((err) => {
        if (err instanceof Error && err.message === 'DELETE_AFTER_UNSHARE_FAILED') {
          return res.status(500).json({
            error: "This circle's albums were unshared, but deleting the circle failed. Please try again.",
          });
        }
        return res.status(500).json({ error: 'Failed to delete circle' });
      });
  },

  addMember: (req, res) => {
    const { id } = req.params;
    const { userId } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Circle not found' });
    }
    if (!isNonEmptyString(userId) || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: 'a valid userId is required' });
    }

    Circle.findById(id)
      .then((circle) => {
        if (!circle) return res.status(404).json({ error: 'Circle not found' });
        if (!isOwnerOrAdmin(circle, req.user)) {
          return res.status(403).json({ error: 'You do not own this circle' });
        }
        if (circle.owner.toString() === userId) {
          return res.status(400).json({ error: 'the owner is already part of the circle' });
        }
        if (isMember(circle, { _id: userId })) {
          return res.status(400).json({ error: 'user is already a member' });
        }
        if (circle.members.length >= MAX_MEMBERS) {
          return res
            .status(400)
            .json({ error: `a circle cannot have more than ${MAX_MEMBERS} members` });
        }

        return User.findById(userId).then((user) => {
          if (!user) return res.status(404).json({ error: 'User not found' });

          // Atomic: the membership check above is a stale read — two
          // concurrent requests could both pass it and both push the same
          // user. Re-assert "not already a member" and "under the cap" as
          // part of the update itself so only one of them can win.
          // status is set explicitly (not left to the schema default) —
          // Mongoose doesn't apply subdocument defaults to a raw $push.
          return Circle.findOneAndUpdate(
            {
              _id: id,
              'members.user': { $ne: userId },
              $expr: { $lt: [{ $size: '$members' }, MAX_MEMBERS] },
            },
            {
              $push: {
                members: {
                  user: userId,
                  status: 'pending',
                  addedAt: new Date(),
                  invitedBy: req.user._id,
                },
              },
            },
            { new: true }
          ).then((updated) => {
            if (updated) {
              notifyCircleInvite({
                circleId: id,
                circleName: updated.name,
                actorUsername: req.user.username,
                actorId: req.user._id,
                recipientId: userId,
              });
              return withUsernames(updated).then((circle) => res.status(201).json({ circle }));
            }
            // Someone else's concurrent request already changed the
            // document — re-read to report the accurate reason.
            return Circle.findById(id).then((current) => {
              if (!current) return res.status(404).json({ error: 'Circle not found' });
              if (isMember(current, { _id: userId })) {
                return res.status(400).json({ error: 'user is already a member' });
              }
              return res
                .status(400)
                .json({ error: `a circle cannot have more than ${MAX_MEMBERS} members` });
            });
          });
        });
      })
      .catch(() => res.status(500).json({ error: 'Failed to add member' }));
  },

  removeMember: (req, res) => {
    const { id, userId } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Circle not found' });
    }
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(404).json({ error: 'Member not found in this circle' });
    }

    Circle.findById(id)
      .then((circle) => {
        if (!circle) return res.status(404).json({ error: 'Circle not found' });

        // Either the owner removes any member, or a member removes themselves.
        const isSelfRemoval = req.user._id.toString() === userId;
        if (!isOwnerOrAdmin(circle, req.user) && !isSelfRemoval) {
          return res.status(403).json({ error: 'You cannot remove this member' });
        }
        const targetMember = circle.members.find(
          (member) => member.user.toString() === userId
        );
        if (!targetMember) {
          return res.status(404).json({ error: 'Member not found in this circle' });
        }
        // Read before the $pull below removes it — a still-pending invite is
        // being revoked (whether the invitee declines it or the owner
        // cancels it), as opposed to an accepted member leaving, so the
        // matching invite notification should flip to read too either way.
        const isPendingInviteRemoval = targetMember.status === 'pending';

        // Atomic $pull, matched only while the member is still present —
        // avoids a stale-array race against a concurrent add/remove on the
        // same circle (mirroring addMember's approach), and also means a
        // repeat removal (double-click, retried request) can't both re-run
        // the $pull as a harmless no-op AND fire a second "invite declined"
        // notification: without the 'members.user' guard, $pull matching
        // zero elements still returns the document as "updated", so a losing
        // concurrent request would notify the inviter twice for one decline.
        return Circle.findOneAndUpdate(
          { _id: id, 'members.user': userId },
          { $pull: { members: { user: userId } } },
          { new: true }
        ).then((updated) => {
          if (updated) {
            if (isPendingInviteRemoval) {
              markCircleInviteRead({ circleId: id, recipientId: userId });
              // Only a genuine self-decline is a "rejection" worth notifying
              // the inviter about — the owner/admin cancelling someone else's
              // pending invite is a different action and should stay silent.
              if (isSelfRemoval) {
                notifyCircleInviteResponse({
                  type: 'circle_invite_declined',
                  circleId: id,
                  circleName: updated.name,
                  invitedBy: targetMember.invitedBy,
                  actingUser: req.user,
                });
              }
            }
            return withUsernames(updated).then((circle) => res.json({ circle }));
          }
          // Either the circle was deleted, or a concurrent request already
          // removed this exact member — re-read to tell the two apart and
          // report success idempotently, without a second notification.
          return Circle.findById(id).then((current) => {
            if (!current) return res.status(404).json({ error: 'Circle not found' });
            return withUsernames(current).then((circle) => res.json({ circle }));
          });
        });
      })
      .catch(() => res.status(500).json({ error: 'Failed to remove member' }));
  },

  // Pending circle invitations addressed to the requester — deliberately a
  // slim summary (no member list) so a not-yet-accepted invitee can't see
  // who else is in the circle before deciding to join.
  listInvites: (req, res) => {
    const page = parsePage(req.query);
    const filter = { members: { $elemMatch: { user: req.user._id, status: 'pending' } } };

    Promise.all([
      Circle.countDocuments(filter),
      Circle.find(filter)
        .sort('-updatedAt')
        .skip((page - 1) * INVITES_PAGE_SIZE)
        .limit(INVITES_PAGE_SIZE),
    ])
      .then(([total, circles]) => {
        const ownerIds = [...new Set(circles.map((circle) => circle.owner.toString()))];
        return User.find({ _id: { $in: ownerIds } }, 'username').then((users) => {
          const usernameByOwnerId = new Map(users.map((user) => [user._id.toString(), user.username]));
          const invites = circles.map((circle) => ({
            _id: circle._id,
            name: circle.name,
            description: circle.description,
            ownerUsername: usernameByOwnerId.get(circle.owner.toString()) ?? DELETED_USER_LABEL,
          }));
          return { total, invites };
        });
      })
      .then(({ total, invites }) =>
        res.json({ invites, total, page, limit: INVITES_PAGE_SIZE })
      )
      .catch(() => res.status(500).json({ error: 'Failed to load invitations' }));
  },

  // Accepting is the one action only the invitee themselves can take —
  // an owner adding someone never grants access on its own.
  respondToInvite: (req, res) => {
    const { id, userId } = req.params;
    const { status } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Circle not found' });
    }
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(404).json({ error: 'Invitation not found' });
    }
    if (status !== 'accepted') {
      return res.status(400).json({ error: "status must be 'accepted'" });
    }
    if (req.user._id.toString() !== userId) {
      return res.status(403).json({ error: 'You can only respond to your own invitation' });
    }

    // Matched only when the member is currently pending — otherwise a
    // repeat accept (double-click, retried request) would both re-run the
    // update as a harmless no-op AND fire a second "invite accepted"
    // notification to the inviter. Requiring the pending->accepted
    // transition here means the notification below only ever fires once,
    // on the actual transition.
    Circle.findOneAndUpdate(
      { _id: id, members: { $elemMatch: { user: userId, status: 'pending' } } },
      { $set: { 'members.$.status': 'accepted' } },
      { new: true }
    )
      .then((updated) => {
        if (updated) {
          markCircleInviteRead({ circleId: id, recipientId: userId });
          const acceptedMember = updated.members.find(
            (member) => member.user.toString() === userId
          );
          notifyCircleInviteResponse({
            type: 'circle_invite_accepted',
            circleId: id,
            circleName: updated.name,
            invitedBy: acceptedMember?.invitedBy,
            actingUser: req.user,
          });
          return withUsernames(updated).then((circle) => res.json({ circle }));
        }
        // No pending invite matched — either it was already accepted
        // (idempotent: report success, no second notification) or there
        // never was one for this user.
        return Circle.findById(id).then((current) => {
          if (!current) return res.status(404).json({ error: 'Invitation not found' });
          const existingMember = current.members.find(
            (member) => member.user.toString() === userId
          );
          if (!existingMember || existingMember.status !== 'accepted') {
            return res.status(404).json({ error: 'Invitation not found' });
          }
          return withUsernames(current).then((circle) => res.json({ circle }));
        });
      })
      .catch(() => res.status(500).json({ error: 'Failed to accept invitation' }));
  },
};
