const { suggestBrainkey } = require('./utils');
const config = require('../config');

async function processWork() {
  console.log('worker is up');
  console.log(suggestBrainkey(config.brainkeyDictionary.en));
}

module.exports = processWork;
