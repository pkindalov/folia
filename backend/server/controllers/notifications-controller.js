const mongoose = require('mongoose');
const Notification = require('../data/Notification');
const User = require('../data/User');
const Album = require('../data/Album');
const Page = require('../data/Page');
const storage = require('../utilities/storage');
const { resolveCoverImages } = require('../utilities/album-cover-image');
const { parsePage, checkAlbumReadAccess, fetchCirclesForAlbums } = require('../utilities/controller-helpers');

const NOTIFICATIONS_PAGE_SIZE = 20;

// album_shared/album_updated show the album's current cover image;
// album_photos_added and page_reaction show the specific photo they
// reference instead (see album-notifications.js) — every other type has
// no thumbnail at all.
const COVER_THUMBNAIL_TYPES = ['album_shared', 'album_updated'];
const PAGE_THUMBNAIL_TYPES = ['album_photos_added', 'page_reaction'];

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

// Batches thumbnail resolution the same way withActorAvatarUrls batches
// avatars: never stored on the notification (photoUrl is signed and
// time-limited, same as avatarUrl), so it's recomputed fresh on every read.
// A notification's existence only proves `user` had access *when it was
// created* — the circle membership or album visibility that granted it can
// change afterward (removed from the circle, album unshared/re-privated)
// without the notification itself being touched. checkAlbumReadAccess is
// re-run against every referenced album here, the same gate every other
// photo-serving path in this codebase goes through, so a since-revoked album
// degrades to no thumbnail instead of quietly leaking photo content the
// recipient can no longer otherwise reach. Returns a Map from notification
// id (string) to thumbnail url or null.
function resolveThumbnailUrls(notifications, user) {
  const coverNotifications = notifications.filter(
    (notification) => COVER_THUMBNAIL_TYPES.includes(notification.type) && notification.album
  );
  const pageNotifications = notifications.filter(
    (notification) => PAGE_THUMBNAIL_TYPES.includes(notification.type) && notification.page && notification.album
  );

  const albumIds = [
    ...new Set([...coverNotifications, ...pageNotifications].map((n) => n.album.toString())),
  ];
  const pageIds = [...new Set(pageNotifications.map((n) => n.page.toString()))];

  return Promise.all([
    albumIds.length > 0 ? Album.find({ _id: { $in: albumIds } }) : Promise.resolve([]),
    pageIds.length > 0 ? Page.find({ _id: { $in: pageIds } }, 'album filename') : Promise.resolve([]),
  ]).then(([albums, pages]) =>
    fetchCirclesForAlbums(albums)
      .then((circleById) =>
        Promise.all(albums.map((album) => checkAlbumReadAccess(album, user, circleById).then((denied) => [album, denied])))
      )
      .then((albumAccessResults) => {
        const accessibleAlbums = albumAccessResults
          .filter(([, denied]) => denied === null)
          .map(([album]) => album);
        const albumById = new Map(accessibleAlbums.map((album) => [album._id.toString(), album]));
        const pageById = new Map(pages.map((page) => [page._id.toString(), page]));

        return resolveCoverImages(accessibleAlbums).then((coverImageByAlbumId) => {
          return new Map(
            notifications.map((notification) => {
              if (COVER_THUMBNAIL_TYPES.includes(notification.type) && notification.album) {
                const thumbnailUrl = coverImageByAlbumId.get(notification.album.toString()) ?? null;
                return [notification._id.toString(), thumbnailUrl];
              }

              if (PAGE_THUMBNAIL_TYPES.includes(notification.type) && notification.page && notification.album) {
                const album = albumById.get(notification.album.toString());
                const page = pageById.get(notification.page.toString());
                // Guard against a page that (somehow) belongs to a different
                // album, same defensive check resolveCoverImages already
                // makes for an explicit coverPage.
                const belongsToAlbum = page && page.album.toString() === notification.album.toString();
                const thumbnailUrl =
                  album && belongsToAlbum ? storage.photoUrl(album.owner, notification.album, page.filename) : null;
                return [notification._id.toString(), thumbnailUrl];
              }

              return [notification._id.toString(), null];
            })
          );
        });
      })
  );
}

// Merges both per-notification extras (actor avatar + thumbnail) computed by
// the two resolvers above, keeping each resolver single-purpose.
function withNotificationExtras(notifications, user) {
  return Promise.all([withActorAvatarUrls(notifications), resolveThumbnailUrls(notifications, user)]).then(
    ([withAvatars, thumbnailUrlById]) =>
      withAvatars.map((notification) => ({
        ...notification,
        thumbnailUrl: thumbnailUrlById.get(notification._id.toString()) ?? null,
      }))
  );
}

function withNotificationExtra(notification, user) {
  return withNotificationExtras([notification], user).then(([withExtras]) => withExtras);
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
        withNotificationExtras(notifications, req.user).then((notificationsWithExtras) =>
          res.json({ notifications: notificationsWithExtras, total, page, limit: NOTIFICATIONS_PAGE_SIZE })
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
        return withNotificationExtra(updated, req.user).then((notification) => res.json({ notification }));
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
        return withNotificationExtra(updated, req.user).then((notification) => res.json({ notification }));
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
