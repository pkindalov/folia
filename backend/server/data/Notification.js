const mongoose = require('mongoose');
const { REACTION_TYPES } = require('./Reaction');

// Every query below filters by type explicitly rather than assuming shape.
const NOTIFICATION_TYPES = [
  'circle_invite',
  'circle_invite_accepted',
  'circle_invite_declined',
  'circle_deleted',
  'album_shared',
  'album_updated',
  'album_deleted',
  'album_photos_added',
  'album_photo_removed',
  'album_photo_caption_updated',
  'page_reaction',
];

// Every other type is scoped to a circle (it's an event on something shared
// with one), so circle/circleName stay required for those. page_reaction
// goes straight to the album owner instead of fanning out to a circle, and
// can fire on a public album with no circle involved at all — required only
// for the types that actually have one.
const requiresCircle = function () {
  return this.type !== 'page_reaction';
};

// The inverse: page/reactionType only ever apply to page_reaction, and are
// required there — mirrors requiresCircle's conditional-required treatment
// rather than leaving these two fields unconstrained.
const requiresPageReaction = function () {
  return this.type === 'page_reaction';
};

// Soft cap per recipient — this is a growing, unbounded top-level
// collection (unlike Circle.members, there's no schema-level array to
// validate), so the cap is enforced by pruning the oldest excess after
// each insert instead.
const MAX_NOTIFICATIONS_PER_USER = 200;

// How long a read notification is kept before MongoDB's TTL monitor
// deletes it automatically. Unread notifications are never touched by
// this — the TTL index below only fires on documents that have `readAt`
// set.
const READ_NOTIFICATION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: '{PATH} is required',
    },
    circle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Circle',
      required: requiresCircle,
    },
    // Snapshots of the circle name and inviting owner's username at the
    // time the invite was sent — a notification is a record of what
    // happened, so it should keep reading correctly even if the circle is
    // later renamed or deleted, rather than needing DELETED_USER_LABEL-style
    // fallback handling like a live join would.
    circleName: {
      type: String,
      required: requiresCircle,
    },
    actorUsername: {
      type: String,
      required: '{PATH} is required',
    },
    // Live reference to the acting user, kept alongside actorUsername rather
    // than replacing it — actorUsername is an intentional historical
    // snapshot (see above), while this is used only to look up the actor's
    // *current* avatar at read time. Never denormalize an avatar URL onto
    // this document: avatarUrl is signed and time-limited (see storage.js),
    // so a stored one would go stale.
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Only set for the album_* and page_reaction types — a snapshot of
    // which album and what its title was, for the same reason circleName is
    // a snapshot: the notification should still read correctly even after
    // the album is later renamed or deleted.
    album: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Album',
    },
    albumTitle: {
      type: String,
    },
    // Only set for page_reaction — which page was reacted to and with what.
    page: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Page',
      required: requiresPageReaction,
    },
    reactionType: {
      type: String,
      enum: REACTION_TYPES,
      required: requiresPageReaction,
    },
    read: {
      type: Boolean,
      default: false,
    },
    // Set the moment a notification is marked read; drives the TTL index
    // below. Left unset for unread notifications, which the TTL monitor
    // ignores.
    readAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ readAt: 1 }, { expireAfterSeconds: READ_NOTIFICATION_TTL_SECONDS });

notificationSchema.method({
  toJSON: function () {
    const obj = this.toObject();
    delete obj.__v;
    return obj;
  },
});

// Deletes the lowest-priority notifications for a recipient beyond the
// per-user cap: already-read ones are pruned before unread ones (an unread
// notification is still actionable and shouldn't disappear just because
// older read ones are sitting around), and within each group the oldest
// goes first. Best-effort and non-blocking by design (see
// circles-controller.js) — a failure here should never affect the request
// that triggered it.
notificationSchema.statics.pruneExcessForRecipient = function (recipientId) {
  return this.countDocuments({ recipient: recipientId }).then((count) => {
    const excess = count - MAX_NOTIFICATIONS_PER_USER;
    if (excess <= 0) return null;

    return this.find({ recipient: recipientId }, '_id')
      .sort({ read: -1, createdAt: 1 })
      .limit(excess)
      .then((lowestPriority) =>
        this.deleteMany({ _id: { $in: lowestPriority.map((doc) => doc._id) } })
      );
  });
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
module.exports.MAX_NOTIFICATIONS_PER_USER = MAX_NOTIFICATIONS_PER_USER;
