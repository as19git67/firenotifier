import path from 'path';
import jf from 'jsonfile';
import config from './config.js';
import _ from 'underscore';
import debug from 'debug';

const debugLogger = debug('firenotifier:data');

let _dataFileLocked = false;

function _unlockDataFile() {
  _dataFileLocked = false;
}

export default class Data {
  #dataFile;
  #locked;

  constructor() {
    this.#locked = false;

    const dataDirectory = config.get('dataDirectory');
    debugLogger(`Data: dataDirectory is ${dataDirectory}`);
    this.#dataFile = path.join(dataDirectory, 'data.json');
    debugLogger(`Data: dataFile is ${this.#dataFile}`);
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
      debugLogger(`getGroups: _initFile`);
      const data = await this.#initFile();
      return data.groups;
    } finally {
      debugLogger(`getGroups: unlocking - finally`);
      this.#unlock();
    }
  }

  async setGroups(groups) {
    try {
      debugLogger(`setGroups: _initFile`);
      const data = await this.#initFile();
      data.groups = _.map(groups, (group) => {
        const id = _.isNumber(group.id) ? group.id.toString() : group.id;
        const description = _.isNumber(group.description) ? group.description.toString() : group.description;
        return {id: id, description: description};
      });
      await jf.writeFile(this.#dataFile, data, {spaces: 2});
    } finally {
      debugLogger(`setGroups: unlocking - finally`);
      this.#unlock();
    }
  }

  async getRecipients() {
    try {
      debugLogger(`getRecipients: _initFile`);
      const data = await this.#initFile();
      return data.recipients;
    } finally {
      debugLogger(`getRecipients: unlocking - finally`);
      this.#unlock();
    }
  }

  async setRecipients(recipients) {
    try {
      debugLogger(`setRecipients: _initFile`);
      const data = await this.#initFile();
      data.recipients = _.map(recipients, (recipient) => {
        const firstname = _.isString(recipient.firstname) ? recipient.firstname : '';
        const lastname = _.isString(recipient.lastname) ? recipient.lastname : '';
        const sms = _.isString(recipient.sms) ? recipient.sms : '';
        const email = _.isString(recipient.email) ? recipient.email : '';
        const groups = _.map(recipient.groups, (group) => {
          const id = _.isNumber(group.id) ? group.id.toString() : group.id;
          if (!_.isString(group.type)) {
            throw new Error('group.type is not a string', {cause: 'notstring'});
          }
          return {id: id, type: group.type};
        })
        return {firstname: firstname, lastname: lastname, sms: sms, email: email, groups: groups};
      });
      await jf.writeFile(this.#dataFile, data, {spaces: 2});
    } finally {
      debugLogger(`setRecipients: unlocking - finally`);
      this.#unlock();
    }
  }

  async getRecipientsOfGroup(groupId) {
    try {
      debugLogger(`getRecipientsOfGroup(${groupId}): _initFile`);
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
      debugLogger(`getRecipientsOfGroup: unlocking - finally`);
      this.#unlock();
    }
  }

}
