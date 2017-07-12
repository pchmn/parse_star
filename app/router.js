const express = require('express'),
      journey = require('./journeyController');

module.exports = function(app) {
  const apiRoutes = express.Router();

  apiRoutes.get("/journeys", journey.getJourneys);

  app.use('/api', apiRoutes);
}
