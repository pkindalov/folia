const mongoose = require('mongoose');

module.exports = {
  health: (req, res) => {
    const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    res.json({
      status: 'ok',
      service: 'folia-backend',
      db: dbStates[mongoose.connection.readyState] || 'unknown',
      uptime: process.uptime(),
    });
  },
};
