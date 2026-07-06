const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema(
  {
    album: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Album',
      required: true,
      index: true,
    },
    filename: {
      type: String,
      required: '{PATH} is required',
    },
    mimeType: {
      type: String,
      required: '{PATH} is required',
    },
    size: {
      type: Number,
      required: '{PATH} is required',
      min: 0,
    },
  },
  { timestamps: true }
);

pageSchema.method({
  toJSON: function () {
    const obj = this.toObject();
    delete obj.__v;
    return obj;
  },
});

module.exports = mongoose.model('Page', pageSchema);
