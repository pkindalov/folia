module.exports = {
  handleMongooseError: (err) => {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0] || 'field';
      return `${field} already exists`;
    }
    if (err.errors) {
      const firstKey = Object.keys(err.errors)[0];
      return err.errors[firstKey].message;
    }
    return 'Invalid data';
  },
};
