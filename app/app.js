const express = require('express'),
      app = express(),
      bodyParser = require('body-parser'),
      router = require('./router');


// body request
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// start the server
const server = app.listen(3000);
console.log('Your server is running on port ' + 3000 + '.');

// routes
router(app);
