import path from 'path';
import jf from 'jsonfile';
import config from './config.js';
import _ from 'underscore';
import debug from 'debug';

const debugLogger = debug('firenotifier:authconfig');

let _dataFileLocked = false;

function _unlockDataFile() {
  _dataFileLocked = false;
}

export default class AuthConfig {
  #dataFile;
  #locked;

  constructor() {
    this.#locked = false;

    const dataDirectory = config.get('authConfigDirectory');
    debugLogger(`AuthConfig: dataDirectory is ${dataDirectory}`);
    this.#dataFile = path.join(dataDirectory, 'authconfig.json');
    debugLogger(`AuthConfig: dataFile is ${this.#dataFile}`);
  }

  // the lock function must be a recursive timer
  async #lock() {
    // check if already locked by this instance
    if (this.#locked) {
      debugLogger('Skip locking with #lock, because already locked by this instance');
      return;
    }
    if (_dataFileLocked) {
      // datafile locked by other instance => wait until free
      debugLogger(`${this.#dataFile} is locked. Trying again later...`);
      await new Promise((resolve, reject) => {
        const timer = setInterval(async () => {
          if (!_dataFileLocked) {
            _dataFileLocked = true;
            this.#locked = true;
            clearInterval(timer);
            resolve();
          }
        }, 250);
      });
    } else {
      _dataFileLocked = true;
      this.#locked = true;
    }
  }

  #unlock() {
    // ignore unlock if explicitly locked by calling lock()
    if (this.#locked) {
      this.#locked = false;
      _unlockDataFile();
    }
  }

  async #initFile(noLock) {
    if (noLock) {
      debugLogger(`#initFile: not locking`);
    } else {
      await this.#lock();
    }
    try {
      return await jf.readFile(this.#dataFile);
    } catch (ex) {
      if (ex.errno === -2) {
        // ENOENT: no such file or directory
        const data = { bearerToken: {}};
        await jf.writeFile(this.#dataFile, data, {spaces: 2});
        return data;
      } else {
        console.log(`Exception in #initFile for ${this.#dataFile}: ${ex.message}`);
        throw ex;
      }
    }
  }

  async getBearerToken() {
    try {
      debugLogger(`getToken: _initFile`);
      const data = await this.#initFile();
      return data.bearerToken;
    } finally {
      debugLogger(`getToken: unlocking - finally`);
      this.#unlock();
    }
  }

  async setBearerToken(bearerToken) {
    try {
      debugLogger(`setBearerToken: _initFile`);
      const data = await this.#initFile();
      data.bearerToken = {};
      for (const bearerTokenKey in bearerToken) {
        data.bearerToken[bearerTokenKey] = bearerToken[bearerTokenKey];
      }
      await jf.writeFile(this.#dataFile, data, {spaces: 2});
    } finally {
      debugLogger(`setBearerToken: unlocking - finally`);
      this.#unlock();
    }
  }

}
