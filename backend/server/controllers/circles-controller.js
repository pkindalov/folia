const mongoose = require('mongoose');
const Circle = require('../data/Circle');
const User = require('../data/User');
const errorHandler = require('../utilities/error-handler');
const { isNonEmptyString, parsePage, DELETED_USER_LABEL } = require('../utilities/controller-helpers');

const { PURPOSES, PRIVACY_LEVELS, MAX_MEMBERS } = Circle;
const INVITES_PAGE_SIZE = 12;
const CIRCLES_PAGE_SIZE = 12;

// Returns an error message, or null when the input is valid.
// For updates, fields that are undefined are simply skipped.
function validateCircleInput(body, { partial = false } = {}) {
  const { name, purpose, privacy } = body || {};

  if (!partial || name !== undefined) {
    if (!isNonEmptyString(name)) return 'name is required';
    if (name.trim().length > 80) return 'name must be at most 80 characters';
  }
  if (!partial || purpose !== undefined) {
    if (!PURPOSES.includes(purpose)) return `purpose must be one of: ${PURPOSES.join(', ')}`;
  }
  if (privacy !== undefined && !PRIVACY_LEVELS.includes(privacy)) {
    return `privacy must be one of: ${PRIVACY_LEVELS.join(', ')}`;
  }
  return null;
}

function canModify(circle, user) {
  return circle.owner.toString() === user._id.toString() || user.roles.includes('Admin');
}

// Distinct from isOwnerOrMember on the model: this checks whether a specific
// *target* user (not necessarily the requester) is already a member — used
// to guard against double-adding, not to authorize a view.
function isMember(circle, user) {
  return circle.members.some((member) => member.user.toString() === user._id.toString());
}

function canView(circle, user) {
  return canModify(circle, user) || circle.isOwnerOrMember(user._id);
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
      members: json.members.map((member) => ({
        ...member,
        username: usernameById.get(member.user.toString()) ?? DELETED_USER_LABEL,
      })),
    };
  });
}

module.exports = {
  list: (req, res) => {
    const page = parsePage(req.query);
    const filter = {
      $or: [{ owner: req.user._id }, { 'members.user': req.user._id }],
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

    const { name, purpose, privacy } = req.body;

    Circle.create({
      name: name.trim(),
      purpose,
      privacy: privacy ?? 'private',
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
        if (!canModify(circle, req.user)) {
          return res.status(403).json({ error: 'You do not own this circle' });
        }

        const { name, purpose, privacy } = req.body;
        if (name !== undefined) circle.name = name.trim();
        if (purpose !== undefined) circle.purpose = purpose;
        if (privacy !== undefined) circle.privacy = privacy;

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
        if (!canModify(circle, req.user)) {
          return res.status(403).json({ error: 'You do not own this circle' });
        }
        return circle.deleteOne().then(() => res.json({ deleted: true }));
      })
      .catch(() => res.status(500).json({ error: 'Failed to delete circle' }));
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
        if (!canModify(circle, req.user)) {
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
              $push: { members: { user: userId, status: 'pending', addedAt: new Date() } },
            },
            { new: true }
          ).then((updated) => {
            if (updated) {
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

    Circle.findById(id)
      .then((circle) => {
        if (!circle) return res.status(404).json({ error: 'Circle not found' });

        // Either the owner removes any member, or a member removes themselves.
        const isSelfRemoval = req.user._id.toString() === userId;
        if (!canModify(circle, req.user) && !isSelfRemoval) {
          return res.status(403).json({ error: 'You cannot remove this member' });
        }
        if (!isMember(circle, { _id: userId })) {
          return res.status(404).json({ error: 'Member not found in this circle' });
        }

        // Atomic $pull — avoids a stale-array race against a concurrent
        // add/remove on the same circle, mirroring addMember's approach.
        return Circle.findOneAndUpdate(
          { _id: id },
          { $pull: { members: { user: userId } } },
          { new: true }
        ).then((updated) => withUsernames(updated).then((circle) => res.json({ circle })));
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
            purpose: circle.purpose,
            privacy: circle.privacy,
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
    if (status !== 'accepted') {
      return res.status(400).json({ error: "status must be 'accepted'" });
    }
    if (req.user._id.toString() !== userId) {
      return res.status(403).json({ error: 'You can only respond to your own invitation' });
    }

    Circle.findOneAndUpdate(
      { _id: id, 'members.user': userId },
      { $set: { 'members.$.status': 'accepted' } },
      { new: true }
    )
      .then((updated) => {
        if (!updated) return res.status(404).json({ error: 'Invitation not found' });
        return withUsernames(updated).then((circle) => res.json({ circle }));
      })
      .catch(() => res.status(500).json({ error: 'Failed to accept invitation' }));
  },
};
