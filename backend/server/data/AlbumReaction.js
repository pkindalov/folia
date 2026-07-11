const mongoose = require('mongoose');

const albumReactionSchema = new mongoose.Schema(
  {
    album: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Album',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// One reaction per user per album — enforced in the database, not just in
// application code, so a race between two concurrent requests can't leave a
// user with two active reactions on the same album. Unlike Reaction (which
// tracks a `type`, since a page can be liked, loved, etc.), an album can only
// be loved, so presence of a row is the reaction — there's nothing to switch.
albumReactionSchema.index({ album: 1, user: 1 }, { unique: true });

albumReactionSchema.method({
  toJSON: function () {
    const obj = this.toObject();
    delete obj.__v;
    return obj;
  },
});

module.exports = mongoose.model('AlbumReaction', albumReactionSchema);
