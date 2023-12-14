import _ from 'underscore';
import BearerStrategy from 'passport-http-bearer';
import AuthConfig from "./authconfig.js";

export default function (passport, callback) {

  passport.use(new BearerStrategy(async function (accessToken, done) {
    // console.log('Bearer Strategy with token ' + accessToken);
    // console.log('BEARER Strategy');

    const authConfig = new AuthConfig();
    const bearers = await authConfig.getBearerToken();
    for (const bearer of Object.keys(bearers)) {
      const tokenName = bearers[bearer];
      console.log(`Have token ${tokenName} for bearer strategy`)
    }

    const username = bearers[accessToken];
    if (username) {
      const info = {scope: '*'};
      const user = {name: username};
      done(null, user, info);
    } else {
      return done({message: 'invalid bearer token', status: 401});
    }

  }));

  if (_.isFunction(callback)) {
    callback(null);
  }
};

// todo: check if unused
export const ensureAuthenticatedForApi = function (req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.statusCode = 401;
  res.json({error: '401 Unauthorized'});
  return null;
};
