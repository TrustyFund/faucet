const { TransactionBuilder } = require('bitsharesjs');

async function userRegistration(regData) {
  const { name, activeKey, ownerKey, registarUserId, referrerUserId, referrerPercent, pKey } = regData;
  const memoKey = activeKey;
  try {

  
  const transaction = new TransactionBuilder();
  
  console.log('wer wer');
  console.log(ownerKey);
  console.log(activeKey);

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
    prefix: 'GPH'
  });
  
  await transaction.set_required_fees();
  await transaction.add_signer(pKey, pKey.toPublicKey().toPublicKeyString());
  let result;
  try {
    result = await transaction.broadcast();
  } catch (error) {
    console.log(error);
  }
  console.log('creation result: ', result);
  return result;
  } catch (error) {
    console.log(error)
  }
}

module.exports = {
  userRegistration
};
