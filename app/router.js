const express = require('express'),
      journey = require('./journeyController');

module.exports = function(app) {
  const apiRoutes = express.Router();

  apiRoutes.post("/journeys", journey.getJourneys);

  app.use('/api', apiRoutes);
}
