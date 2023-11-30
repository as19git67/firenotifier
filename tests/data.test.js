import {expect} from 'chai';
import {Data} from 'data';

describe('Testing the Datafile function', () => {

  it('Initializing Data', async () => {
    const data = new Data();
    await data.initialize();
  });
});
