import nconf from 'nconf';
import fs from 'fs';
import path from 'path';
import _ from 'underscore';

const configFilename = 'settings.json';
let configFilepath = path.join(__dirname, configFilename);
nconf.file({file: configFilepath});
nconf.listenForChange = function (callback) {
  if (_.isFunction(callback)) {
    console.log("Callback installed to listen for changes");
    nconf.settingsChangedCallback = callback;
  } else {
    delete nconf.settingsChangedCallback;
  }
};

watchForConfigChange(configFilepath);

function watchForConfigChange(cfgFilepath) {
  console.log("watchForConfigChange started");
  let reloadingTimer;
  let waitForFileExistsInterval;

  if (fs.existsSync(cfgFilepath)) {
    let isInRename = false;
    fs.watch(cfgFilepath, (event, filename) => {
      switch (event) {
        case 'rename':
          if (isInRename) {
            return;
          }
          isInRename = true;
          console.log(cfgFilepath + " renamed to " + filename);
          // wait for file to be back again
          if (!waitForFileExistsInterval) {
            clearInterval(waitForFileExistsInterval);
          }
          waitForFileExistsInterval = setInterval(() => {
            if (fs.existsSync(cfgFilepath)) {
              clearInterval(waitForFileExistsInterval);
              nconf.load(function (err) {
                if (err) {
                  console.log("Reloading configuration file after rename" + cfgFilepath + " failed: " + err.toString());
                } else {
                  console.log("Reloaded configuration after rename from " + cfgFilepath);
                  if (nconf.settingsChangedCallback) {
                    nconf.settingsChangedCallback();
                  }
                }
                console.log("watching again for changes in configuration file " + cfgFilepath);
                watchForConfigChange(cfgFilepath);
              });
            }
          }, 1500);
          isInRename = true;
          break;
        case 'change':
          console.log(cfgFilepath + " changed");
          if (!reloadingTimer) {
            clearTimeout(reloadingTimer);
            reloadingTimer = undefined;
          }
          reloadingTimer = setTimeout(() => {
            reloadingTimer = undefined;
            nconf.load(function (err) {
              if (err) {
                console.log("Reloading configuration file after change" + cfgFilepath + " failed: " + err.toString());
              } else {
                console.log("Reloaded configuration after change from " + cfgFilepath);
              }
            });
          }, 2000);

          break;
        default:
          console.log(cfgFilepath + ' changed ', event);
      }
    });
  } else {
    console.log("WARNING: settings.json does not exist");
  }
}

nconf.defaults({
  "httpPort": 5002,
  "bearerTokens": {},
  "configSyncDestinations": [],
  "minWaitMinutesToNotifySameGroup": 2,
  "sms_client_id": "",
  "sms_client_secret": "",
  "sms_validity_hours": 26,
  "sms_wait_for_status": 600,
  "sms_sender_nr": "",
  "email_smtp_sender_email": "",
  "email_smtp_username": "",
  "email_smtp_password": "",
  "email_smtp_use_SSL": false,
  "email_smtp_server_host": "",
  "email_smtp_server_port": "",
  "email_postmaster_address": "",
  "dataDirectory": "/data",
  "XXXgroups":
    [{"id": "22222", "description": "test gruppe"}],
  "XXrecipients": [
    {
      "firstname": "Anton",
      "lastname": "Schegg",
      "groups": [{"id": "22222", "type": "sms"}, {"id": "info22222", "type": "email"}],
      "sms": "+49163",
      "email": "a@bc.de"
    }
  ]
});

module.exports = nconf;
