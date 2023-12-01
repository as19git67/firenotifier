import fs from 'fs';
import {expect} from 'chai';
import nconf from 'nconf';
import Data from '../data.js';
import path from "path";

nconf.defaults({
  dataDirectory: "./tests"
});

describe('Testing the Datafile function', () => {

  before(async function() {
    const filePath = path.join(nconf.get('dataDirectory'), 'data.json');
    try {
      await fs.promises.unlink(filePath);
    } catch(ex) {
      if (ex.errno === -2) {
        return; // ignore file not found (ENOENT)
      }
      console.log(ex);
      fail(ex.message);
    }
  });

  after(async function() {
    try {
      const filePath = path.join(nconf.get('dataDirectory'), 'data.json');
      await fs.promises.unlink(filePath);
    } catch(ex) {
      if (ex.errno === -2) {
        return; // ignore file not found (ENOENT)
      }
      console.log(ex);
      fail(ex);
    }
  });

  it('Initializing Data', async function() {
    const data = new Data();
    const groups = await data.getGroups();
    const recipients = await data.getRecipients();

    expect(groups.length).to.equal(0);
    expect(recipients.length).to.equal(0);
  });

  it('Set groups', async function() {
    const data = new Data();
    await data.setGroups([{id: 'alpha', description: 'alpha group'}, {id: 2, description: 'group beta', other: 'super'}]);
    const groups = await data.getGroups();

    expect(groups.length).to.equal(2);
    expect(groups[0].id).to.equal('alpha');
    expect(groups[0].description).to.equal('alpha group');
    expect(groups[1].id).to.equal('2');
    expect(groups[1].description).to.equal('group beta');
    expect(groups[1].other).to.be.undefined;
  });


  it('Set recipients', async function() {
    const data = new Data();
    await data.setRecipients([
      {
        "firstname": "Joe",
        "lastname": "Miller",
        "groups": [{"id": "22222", "type": "sms", butter: "milk"}, {"id": "info22222", "type": "email"}],
        "sms": "+4915228895456",
        "email": "joe.miller@example.com"
      },
      {
        "firstname": "Mia",
        "lastname": "Sunshine",
        "groups": [{"id": "22222", "type": "sms"}, {"id": "22223", "type": "email"}],
        "sms": "+4915254599371",
        "email": "mia.sun@example.com"
      }
    ]);
    const recipients = await data.getRecipients();

    expect(recipients.length).to.equal(2);
    expect(recipients[0].firstname).to.equal('Joe');
    expect(recipients[0].lastname).to.equal('Miller');
    expect(recipients[0].sms).to.equal('+4915228895456');
    expect(recipients[0].email).to.equal('joe.miller@example.com');
    expect(recipients[0].groups.length).to.equal(2);
    expect(recipients[0].groups[0].id).to.equal('22222');
    expect(recipients[0].groups[0].type).to.equal('sms');
    expect(recipients[0].groups[0].butter).to.be.undefined;
    expect(recipients[0].groups[1].id).to.equal('info22222');
    expect(recipients[0].groups[1].type).to.equal('email');
    expect(recipients[1].firstname).to.equal('Mia');
    expect(recipients[1].lastname).to.equal('Sunshine');
    expect(recipients[1].sms).to.equal('+4915254599371');
    expect(recipients[1].email).to.equal('mia.sun@example.com');
    expect(recipients[1].groups.length).to.equal(2);
    expect(recipients[1].groups[0].id).to.equal('22222');
    expect(recipients[1].groups[0].type).to.equal('sms');
    expect(recipients[1].groups[1].id).to.equal('22223');
    expect(recipients[1].groups[1].type).to.equal('email');
  });

  it('Parallel - locking', async function() {
    const data1 = new Data();
    const data2 = new Data();
    const data3 = new Data();
    const p1 = data1.setGroups([{id: 'alpha', description: 'alpha group'}, {id: 2, description: 'group beta'}]);
    const p2 = data2.getGroups();
    const p3 = data3.setGroups([{id: 'gamma', description: 'group c'}, {id: 3, description: 'group three'}, {id: '4', description: 4}]);
    const p4 = data2.getGroups();
    const values = await Promise.all([p1, p2, p3, p4]);
    expect(values[1].length).to.equal(2);
    expect(values[1][0].id).to.equal('alpha');
    expect(values[1][0].description).to.equal('alpha group');
    expect(values[1][1].id).to.equal('2');
    expect(values[1][1].description).to.equal('group beta');

    expect(values[3].length).to.equal(3);
    expect(values[3][0].id).to.equal('gamma');
    expect(values[3][0].description).to.equal('group c');
    expect(values[3][1].id).to.equal('3');
    expect(values[3][1].description).to.equal('group three');
    expect(values[3][2].id).to.equal('4');
    expect(values[3][2].description).to.equal('4');

  })

});
