const fs = require('fs');
const path = require('path');
const jf = require('jsonfile');
const config = require('./config');

let _dataFileLocked = false;

function _unlockDataFile() {
  _dataFileLocked = false;
}

module.exports = class Data {
  #dataFile;
  #locked;

  constructor() {
    this.#locked = false;

    const dataDirectory = config.get('dataDirectory');
    console.log(`Data: dataDirectory is ${dataDirectory}`);
    this.#dataFile = path.join(dataDirectory, 'data.json');
    console.log(`Data: dataFile is ${this.#dataFile}`);
  }

  // the lock function must be a recursive timer
  async #lock() {
    // check if already locked by this instance
    if (this.#locked) {
      // console.log('Skip locking with #lock, because already locked by this instance');
      return;
    }
    if (_dataFileLocked) {
      // datafile locked by other instance => wait until free
      console.log(`${this.#dataFile} is locked. Trying again later...`);
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
      console.log(`#initFile: not locking`);
    } else {
      await this.#lock();
    }
    try {
      return await jf.readFile(this.#dataFile);
    } catch (ex) {
      if (ex.errno === -2) {
        // ENOENT: no such file or directory
        const data = {groups: [], recipients: []};
        await jf.writeFile(this.#dataFile, data, {spaces: 2});
        return data;
      } else {
        console.log(`Exception in #initFile for ${this.#dataFile}: ${ex.message}`);
        throw ex;
      }
    }
  }

  async getGroups() {
    try {
      console.log(`getGroups: _initFile`);
      const data = await this.#initFile();
      return data.groups;
    } finally {
      console.log(`getGroups: unlocking - finally`);
      this.#unlock();
    }
  }

  async getRecipients() {
    try {
      console.log(`getRecipients: _initFile`);
      const data = await this.#initFile();
      return data.recipients;
    } finally {
      console.log(`getRecipients: unlocking - finally`);
      this.#unlock();
    }
  }

  async getRecipientsOfGroup(groupId) {
    try {
      console.log(`getRecipientsOfGroup(${groupId}): _initFile`);
      const data = await this.#initFile();
      if (!_.findWhere(data.groups, {id: groupId})) {
        throw new Error("Group does not exist", {cause: 'noexist'});
      }
      let recipients = [];
      _.each(data.recipients, (recipient) => {
        if (_.findWhere(recipient.groups, {id: groupId})) {
          recipients.push(recipient);
        }
      });
      return recipients;
    } finally {
      console.log(`getRecipientsOfGroup: unlocking - finally`);
      this.#unlock();
    }
  }

}
