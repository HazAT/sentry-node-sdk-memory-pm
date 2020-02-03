const express = require('express');
const app = express();
const Sentry = require('@sentry/node');


// Enter your DSN here
const dsn = 'YOUR_DSN';

if (dsn === 'YOUR_DSN') {
  console.error('PLEASE PASTE YOUR DSN INTO express.js FILE');
  process.exit(1);
}

Sentry.init({
  dsn,
  // debug: true
});

app.use(Sentry.Handlers.requestHandler());

app.get('/', function mainHandler(req, res) {
    Sentry.configureScope(function (scope) {
      let obj = {};
      for (let i = 0; i < 5000; i++) {
        obj[`index${i}`] = [new String('ABC'.repeat(100))];
      }
      scope.setExtra("foo", obj);
    });

    throw new Error('aaa');
});

app.use(Sentry.Handlers.errorHandler());

app.use(function onError(err, req, res, next) {
  res.statusCode = 500;
  res.end(res.sentry + '\n');
});

app.listen(3000);