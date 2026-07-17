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
  'album_reaction',
  'page_comment',
  'comment_reply',
];

// Types that go straight to a single recipient (the album owner for
// page_reaction/album_reaction/page_comment, the parent comment's author for
// comment_reply) rather than fanning out to a circle, and can fire on a
// public album with no circle involved at all — circle/circleName stay
// required for every other type, which is scoped to a circle (an event on
// something shared with one).
const CIRCLE_EXEMPT_TYPES = ['page_reaction', 'album_reaction', 'page_comment', 'comment_reply'];

const requiresCircle = function () {
  return !CIRCLE_EXEMPT_TYPES.includes(this.type);
};

// The inverse: reactionType only ever applies to page_reaction, and is
// required there — mirrors requiresCircle's conditional-required treatment
// rather than leaving it unconstrained. page is also gated by this (required
// for page_reaction), but unlike reactionType it isn't exclusive to that
// type — see the comment on the page field below.
const requiresPageReaction = function () {
  return this.type === 'page_reaction';
};

// commentText applies to page_comment and comment_reply (a reply's own
// text), and is required on both — same conditional-required treatment as
// requiresPageReaction above.
const requiresPageComment = function () {
  return this.type === 'page_comment' || this.type === 'comment_reply';
};

// page is required for page_reaction, page_comment, or comment_reply —
// which page was reacted to / commented on / replied to. Also set,
// optionally, on album_photos_added (see the comment on the page field
// below), so this can't just be requiresPageReaction.
const requiresPage = function () {
  return this.type === 'page_reaction' || this.type === 'page_comment' || this.type === 'comment_reply';
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
    // Required for page_reaction/page_comment/comment_reply (which page was
    // reacted to / commented on / replied to). Also set, optionally, on
    // album_photos_added as a representative photo from the uploaded batch.
    // Used by notifications-controller.js to show a thumbnail and deep-link
    // to that photo for all four types; not required on album_photos_added
    // since a notification predating this feature (or one whose batch
    // somehow yielded no pages) simply has none.
    page: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Page',
      required: requiresPage,
    },
    reactionType: {
      type: String,
      enum: REACTION_TYPES,
      required: requiresPageReaction,
    },
    // Snapshot of the comment body at creation time, same "survives later
    // edits/deletes" reasoning as albumTitle — a notification is a record of
    // what happened, so deleting the comment shouldn't make this stop
    // reading correctly.
    commentText: {
      type: String,
      required: requiresPageComment,
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
