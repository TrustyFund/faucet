const { key } = require('bitsharesjs');

function suggestBrainkey(dictionary) {
  return key.suggest_brain_key(dictionary);
}

module.exports = {
  suggestBrainkey
};
