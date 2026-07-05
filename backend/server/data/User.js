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
  User.find({}).then((users) => {
    if (users.length > 0) return;

    // No predictable default: use ADMIN_PASSWORD or generate a random one
    let password = process.env.ADMIN_PASSWORD;
    let generated = false;
    if (!password) {
      password = require('crypto').randomBytes(12).toString('base64url');
      generated = true;
    }

    const salt = encryption.generateSalt();
    const hashedPass = encryption.generateHashedPassword(salt, password);

    User.create({
      username: 'Admin',
      email: process.env.ADMIN_EMAIL || 'admin@folia.local',
      salt,
      hashedPass,
      roles: ['Admin'],
    }).then(() => {
      if (generated) {
        console.log(`Admin user seeded with generated password: ${password}`);
        console.log('(Shown once — save it, or set ADMIN_PASSWORD and reset the DB.)');
      } else {
        console.log('Admin user seeded');
      }
    });
  });
};
