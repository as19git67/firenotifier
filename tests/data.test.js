import {expect} from 'chai';
import {Data} from '../data';

describe('Testing the Datafile function', () => {

  it('Initializing Data', async () => {
    const data = new Data();
    const groups = await data.getGroups();
    const recipients = await data.getRecipients();
    
    expect(recipients.length).to.Be(0);
  });
});
