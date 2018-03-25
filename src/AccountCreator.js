const { TransactionBuilder } = require('bitsharesjs');
const { key } = require('bitsharesjs');

async function userRegistration(regData) {
  const { brainkey, name, registarUserId, referrerUserId, referrerPercent, pKey } = regData;
  const activeKey = key.get_brainPrivateKey(brainkey, 1).toPublicKey();
  const ownerKey = key.get_brainPrivateKey(brainkey, 0).toPublicKey();
  const memoKey = activeKey;

  const transaction = new TransactionBuilder();

  transaction.add_type_operation('account_create', {
    registrar: registarUserId,
    referrer: referrerUserId,
    referrer_percent: referrerPercent,
    name,
    owner: {
      account_auths: [],
      key_auths: [[ownerKey, 1]],
      address_auths: [],
      weight_threshold: 1
    },
    active: {
      account_auths: [],
      key_auths: [[activeKey, 1]],
      address_auths: [],
      weight_threshold: 1
    },
    options: {
      memo_key: memoKey,
      voting_account: '1.2.5',
      num_witness: 0,
      num_committee: 0,
      votes: [],
      extensions: []
    },
    extensions: {},
    prefix: 'BTS'
  });

  await transaction.set_required_fees();
  await transaction.add_signer(pKey, pKey.toPublicKey().toPublicKeyString());
  const result = await transaction.broadcast();
  return result;
}

module.exports = {
  userRegistration
};
