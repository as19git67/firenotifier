const _ = require('underscore');
const BearerStrategy = require('passport-http-bearer').Strategy;
const config = require('./config');

module.exports.init = function (passport, callback) {

  passport.use(new BearerStrategy(function (accessToken, done) {
      // console.log('Bearer Strategy with token ' + accessToken);
      // console.log('BEARER Strategy');

      const bearers = config.get('bearerTokens');
      const username = bearers[accessToken];
      if (username) {
        const info = {scope: '*'};
        const user = {name: username};
        done(null, user, info);
      } else {
        return done({message: 'invalid bearer token', status: 401});
      }

    }
  ));

  if (_.isFunction(callback)) {
    callback(null);
  }
};

module.exports.ensureAuthenticatedForApi = function (req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.statusCode = 401;
  res.json({error: '401 Unauthorized'});
  return null;
};
