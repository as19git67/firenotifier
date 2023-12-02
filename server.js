#!/usr/bin/env node

import path from 'path';
import http from 'http';
import https from 'https';
import debug from 'debug';
import app from './app.js';
import Data from './data.js';
import config from './config.js';
import fs from "fs";
import { fileURLToPath } from 'url';

const debugLogger = debug('firenotifier:server');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let server;
let port;

app.doInitialConfig().then(async function () {
  let testMode = !!config.get('TEST');

  if (testMode) {
    console.log("TEST MODE activated");
  }

  // data file
  const data = new Data();
  const groups = await data.getGroups();
  const recipients = await data.getRecipients();

  console.log(`Datafile has ${groups.length} groups and ${recipients.length} recipients`);

  port = config.get('httpsPort');

  if (port) {
    app.set('port', port);
    try {
      const secureOptions = {
        key: fs.readFileSync(path.resolve(__dirname, 'key.pem')),
        cert: fs.readFileSync(path.resolve(__dirname, 'cert.pem'))
      };
      // Create HTTPS server
      server = https.createServer(secureOptions, app);

      // Listen on provided port, on all network interfaces.
      server.listen(port, function () {
        console.log(app.get('appName') + ' https server listening on port ' + port);
      });
      server.on('error', onError);
      server.on('listening', onListening);
    } catch (e) {
      console.log("EXCEPTION while creating the https server:", e);
    }
  } else {
    // no https -> try http
    port = process.env.PORT || config.get('httpPort');
    //const httpPort = normalizePort(process.env.PORT || '3000');
    if (port) {
      app.set('port', port);
      // Create HTTP server
      server = http.createServer(app);

      // Listen on provided port, on all network interfaces.
      server.listen(port, function () {
        console.log(app.get('appName') + ' http server listening on port ' + port);
      });
      server.on('error', onError);
      server.on('listening', onListening);
    }
  }

}).catch(reason => {
  console.log(reason);
  console.log("Not starting web-server, because initial configuration failed.");
});

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  let port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  let bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  const addr = server.address();
  let bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debugLogger('Listening on ' + bind);

  // push configuration to backup server
  app.pushConfigToBackupServer();
  config.listenForChange(function () {
    console.log("Configuration changed -> pushing config to backup server");
    app.pushConfigToBackupServer();
  })
}
