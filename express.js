require('dotenv').config();

const express = require('express');
const app = express();
const Sentry = require('@sentry/node');

// Load DSN from environment variable
const dsn = process.env.SENTRY_DSN;

if (!dsn) {
  console.error('SENTRY_DSN environment variable is required. Please add it to your .env file.');
  process.exit(1);
}

Sentry.init({
  dsn,
  sendDefaultPii: true,
  tracesSampleRate: 1.0,
  // debug: true
});

app.get('/', function mainHandler(req, res) {
    Sentry.withScope(function (scope) {
      let obj = {};
      for (let i = 0; i < 5000; i++) {
        obj[`index${i}`] = [new String('ABC'.repeat(100))];
      }
      scope.setExtra("foo", obj);
      
      throw new Error('aaa');
    });
});

// Add Sentry error handler after all routes, before other error handling
Sentry.setupExpressErrorHandler(app);

app.use(function onError(err, req, res, next) {
  res.statusCode = 500;
  res.end(res.sentry + '\n');
});

app.listen(3000);