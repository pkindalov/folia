const mongoose = require('mongoose');

const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];

const reactionSchema = new mongoose.Schema(
  {
    page: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Page',
      required: true,
      index: true,
    },
    // Denormalized from page.album so a whole album's reactions can be
    // cascade-deleted with a single query, the same way Page.album lets an
    // album's pages be cascade-deleted without looking each one up first.
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
    type: {
      type: String,
      enum: REACTION_TYPES,
      required: '{PATH} is required',
    },
  },
  { timestamps: true }
);

// One reaction per user per page — enforced in the database, not just in
// application code, so a race between two concurrent requests can't leave a
// user with two active reactions on the same page.
reactionSchema.index({ page: 1, user: 1 }, { unique: true });

reactionSchema.method({
  toJSON: function () {
    const obj = this.toObject();
    delete obj.__v;
    return obj;
  },
});

const Reaction = mongoose.model('Reaction', reactionSchema);

module.exports = Reaction;
module.exports.REACTION_TYPES = REACTION_TYPES;
