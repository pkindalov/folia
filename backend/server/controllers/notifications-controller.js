const mongoose = require('mongoose');
const Notification = require('../data/Notification');
const { parsePage } = require('../utilities/controller-helpers');

const NOTIFICATIONS_PAGE_SIZE = 20;

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
        res.json({ notifications, total, page, limit: NOTIFICATIONS_PAGE_SIZE })
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
        return res.json({ notification: updated });
      })
      .catch(() => res.status(500).json({ error: 'Failed to update notification' }));
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
};
