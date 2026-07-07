const mongoose = require('mongoose');

const albumSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: '{PATH} is required',
      trim: true,
      maxlength: [120, 'title must be at most 120 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'description must be at most 2000 characters'],
    },
    visibility: {
      type: String,
      enum: ['private', 'shared', 'public'],
      default: 'private',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    pageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Explicit cover choice. When null, the earliest-uploaded page is used —
    // see resolveCoverImage in albums-controller.js.
    coverPage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Page',
      default: null,
    },
    // A volume the owner has filed away — hidden from the main gallery,
    // shown only in the Archive. Unrelated to visibility/access control.
    archived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

albumSchema.method({
  toJSON: function () {
    const obj = this.toObject();
    delete obj.__v;
    return obj;
  },
});

module.exports = mongoose.model('Album', albumSchema);
