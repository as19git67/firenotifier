import createError from 'http-errors';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import _ from 'underscore';
import axios from 'axios';
import { fileURLToPath } from 'url';

import config from './config.js';
import apiRouter from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set('appName', 'Notifier');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

import passport from 'passport';
import passportStrategies from './passport-strategies.js';

app.use(logger('combined', {
  // log only on errors
  skip: function (req, res) {
    return res.statusCode < 400 || res.statusCode === 429
  }
}));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  //res.json({status: err.status || 500, message: err.message});
  res.status(err.status || 500).json({error: err.message});
});

app.doInitialConfig = function () {
  return new Promise((resolve, reject) => {
    resolve();
  });
};

const lazyPushConfig = _.debounce(function (syncDestination) {

    let restapiUrl = syncDestination.restapiUrl;
    let authorizationBearer = syncDestination.authorizationBearer;
    let acceptSelfSignedCertificate = syncDestination.acceptSelfSignedCertificate;

    if (restapiUrl && authorizationBearer) {
      console.log(`push configuration to ${restapiUrl}`);
      let reqOpts = {
        url: restapiUrl,
        auth: {bearer: authorizationBearer},
        method: 'POST',
        json: {groups: config.get('groups'), recipients: config.get('recipients')}
      };

      if (acceptSelfSignedCertificate) {
        console.log("Accepting self signed certificate for " + restapiUrl);
        reqOpts.agentOptions = {
          insecure: true,
          rejectUnauthorized: false
        };
      }

      const agent = new https.Agent({
        rejectUnauthorized: false
      });

      axios.post(restapiUrl, {groups: config.get('groups'), recipients: config.get('recipients')},
        {headers: {auth: {bearer: authorizationBearer}}, httpsAgent: agent}).then((httpResponse) => {
        if (httpResponse.statusCode === 200) {
          console.log(`config push to ${restapiUrl} was successful`);
        } else {
          console.log(`config push to ${restapiUrl} returned status ${httpResponse.statusCode}: ${httpResponse.statusMessage}`);
        }
      }).catch((error) => {
        console.log('ERROR while sending request for config push:', err);
      });

    } else {
      console.log("Skipped config sync destination, because not fully configured");
    }

}, 70000);

app.pushConfigToBackupServer = function () {
  const configSyncDest = config.get("configSyncDestination");
  if (configSyncDest) {
    lazyPushConfig(configSyncDest);
  } else {
    console.log("Not pushing configuration, because configSyncDestionations are not fully specified in configuration");
  }
};

passportStrategies(passport);

export default app;
