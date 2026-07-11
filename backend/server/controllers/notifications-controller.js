const mongoose = require('mongoose');
const Notification = require('../data/Notification');
const User = require('../data/User');
const storage = require('../utilities/storage');
const { parsePage } = require('../utilities/controller-helpers');

const NOTIFICATIONS_PAGE_SIZE = 20;

// Batches actor-avatar resolution for a page of notifications into a single
// User lookup (mirrors albums-controller.js's resolveCoverImages) instead of
// one query per row. Never stored on the notification itself: avatarUrl is
// signed and time-limited, so it has to be recomputed on every read. Falls
// back to null for legacy notifications with no `actor` set, or one whose
// actor account no longer exists — the frontend's Avatar component already
// falls back to initials (from the actorUsername snapshot) in that case.
function withActorAvatarUrls(notifications) {
  const actorIds = [
    ...new Set(
      notifications.filter((notification) => notification.actor).map((notification) => notification.actor.toString())
    ),
  ];

  return (actorIds.length > 0 ? User.find({ _id: { $in: actorIds } }, 'avatarFilename') : Promise.resolve([])).then(
    (users) => {
      const avatarUrlByActorId = new Map(
        users.map((user) => [
          user._id.toString(),
          user.avatarFilename ? storage.avatarUrl(user._id, user.avatarFilename) : null,
        ])
      );

      return notifications.map((notification) => ({
        ...notification.toJSON(),
        actorAvatarUrl: notification.actor ? avatarUrlByActorId.get(notification.actor.toString()) ?? null : null,
      }));
    }
  );
}

function withActorAvatarUrl(notification) {
  return withActorAvatarUrls([notification]).then(([withAvatar]) => withAvatar);
}

module.exports = {
  list: (req, res) => {
    const page = parsePage(req.query);
    const filter = { recipient: req.user._id };

    Promise.all([
      Notification.countDocuments(filter),
      Notification.find(filter)
        .sort('-createdAt')
        .skip((page - 1) * NOTIFICATIONS_PAGE_SIZE)
        .limit(NOTIFICATIONS_PAGE_SIZE),
    ])
      .then(([total, notifications]) =>
        withActorAvatarUrls(notifications).then((notificationsWithAvatars) =>
          res.json({ notifications: notificationsWithAvatars, total, page, limit: NOTIFICATIONS_PAGE_SIZE })
        )
      )
      .catch(() => res.status(500).json({ error: 'Failed to load notifications' }));
  },

  unreadCount: (req, res) => {
    Notification.countDocuments({ recipient: req.user._id, read: false })
      .then((count) => res.json({ count }))
      .catch(() => res.status(500).json({ error: 'Failed to load unread count' }));
  },

  // Scoped to the requester via `recipient` in the filter itself — a 404
  // covers both "doesn't exist" and "isn't yours" so a guessable id can't
  // be used to probe for other users' notifications.
  markRead: (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    Notification.findOneAndUpdate(
      { _id: id, recipient: req.user._id },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    )
      .then((updated) => {
        if (!updated) return res.status(404).json({ error: 'Notification not found' });
        return withActorAvatarUrl(updated).then((notification) => res.json({ notification }));
      })
      .catch(() => res.status(500).json({ error: 'Failed to update notification' }));
  },

  // Inverse of markRead. $unset (not $set: { readAt: null }) so the field
  // goes fully absent again, matching a freshly-created notification's shape
  // and keeping it correctly ignored by the readAt TTL index.
  markUnread: (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    Notification.findOneAndUpdate(
      { _id: id, recipient: req.user._id },
      { $set: { read: false }, $unset: { readAt: '' } },
      { new: true }
    )
      .then((updated) => {
        if (!updated) return res.status(404).json({ error: 'Notification not found' });
        return withActorAvatarUrl(updated).then((notification) => res.json({ notification }));
      })
      .catch(() => res.status(500).json({ error: 'Failed to update notification' }));
  },

  markAllRead: (req, res) => {
    Notification.updateMany(
      { recipient: req.user._id, read: false },
      { $set: { read: true, readAt: new Date() } }
    )
      .then((result) => res.json({ updated: true, count: result.modifiedCount }))
      .catch(() => res.status(500).json({ error: 'Failed to update notifications' }));
  },

  markAllUnread: (req, res) => {
    Notification.updateMany(
      { recipient: req.user._id, read: true },
      { $set: { read: false }, $unset: { readAt: '' } }
    )
      .then((result) => res.json({ updated: true, count: result.modifiedCount }))
      .catch(() => res.status(500).json({ error: 'Failed to update notifications' }));
  },

  dismiss: (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    Notification.findOneAndDelete({ _id: id, recipient: req.user._id })
      .then((deleted) => {
        if (!deleted) return res.status(404).json({ error: 'Notification not found' });
        return res.json({ deleted: true });
      })
      .catch(() => res.status(500).json({ error: 'Failed to dismiss notification' }));
  },

  deleteAll: (req, res) => {
    Notification.deleteMany({ recipient: req.user._id })
      .then((result) => res.json({ deleted: true, count: result.deletedCount }))
      .catch(() => res.status(500).json({ error: 'Failed to delete notifications' }));
  },
};
