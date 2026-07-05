const mongoose = require('mongoose');
const encryption = require('../utilities/encryption');

const REQUIRED_VALIDATION_MESSAGE = '{PATH} is required';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: REQUIRED_VALIDATION_MESSAGE,
      unique: true,
      trim: true,
      minlength: [3, 'username must be at least 3 characters'],
    },
    email: {
      type: String,
      required: REQUIRED_VALIDATION_MESSAGE,
      unique: true,
      lowercase: true,
      trim: true,
    },
    salt: String,
    hashedPass: String,
    roles: [String],
  },
  { timestamps: true }
);

userSchema.method({
  authenticate: function (password) {
    return encryption.verifyPassword(this.salt, password, this.hashedPass);
  },
  toJSON: function () {
    const obj = this.toObject();
    delete obj.salt;
    delete obj.hashedPass;
    delete obj.__v;
    return obj;
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.seedAdminUser = () => {
  User.findOne({ username: 'Admin' }).then((existing) => {
    if (existing) return;

    // Explicit over implicit: the admin password always comes from the
    // ADMIN_PASSWORD env var. No password, no admin — with a clear warning.
    const password = process.env.ADMIN_PASSWORD;
    if (!password) {
      console.warn(
        'ADMIN_PASSWORD is not set — skipping admin seeding. ' +
          'Set it in .env and restart, or run: npm run set-admin-password'
      );
      return;
    }

    const salt = encryption.generateSalt();
    const hashedPass = encryption.generateHashedPassword(salt, password);

    User.create({
      username: 'Admin',
      email: process.env.ADMIN_EMAIL || 'admin@folia.local',
      salt,
      hashedPass,
      roles: ['Admin'],
    }).then(() => console.log('Admin user seeded (password from ADMIN_PASSWORD)'));
  });
};
