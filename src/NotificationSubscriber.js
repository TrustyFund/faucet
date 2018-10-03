const { TransactionHelper } = require('bitsharesjs');
const { Aes } = require('bitsharesjs');
const { TransactionBuilder } = require('bitsharesjs');
const { Apis } = require('bitsharesjs-ws');

class MoneySender {
  constructor(privateKey, memoKey, fromAccountId, toAccountId) {
    this.pKey = privateKey;
    this.memoFromKey = memoKey;
    this.fromAccountId = fromAccountId;
    this.toAccountId = toAccountId;
  }

  async subscribe(id, email) {
    const [toAccount] = await Apis.instance().db_api().exec('get_full_accounts', [[this.toAccountId], false]);
    const memoToKey = toAccount[1].account.options.memo_key;
    const memo = id + ':email:' + email;
    const nonce = TransactionHelper.unique_nonce_uint64();

    const memoObject = {
      from: this.memoFromKey,
      to: memoToKey,
      nonce,
      message: Aes.encrypt_with_checksum(
        this.pKey,
        memoToKey,
        nonce,
        memo,
      )
    };

    const transaction = new TransactionBuilder();

    transaction.add_type_operation('transfer', {
      fee: {
        amount: 0,
        asset_id: '1.3.0'
      },
      from: this.fromAccountId,
      to: this.toAccountId,
      amount: { amount: 1, asset_id: '1.3.0' },
      memo: memoObject
    });

    transaction.set_required_fees().then(() => {
      transaction.add_signer(this.pKey, this.pKey.toPublicKey().toPublicKeyString());
      console.log('serialized transaction:', JSON.stringify(transaction.serialize()));
      transaction.broadcast(() => {
        console.log('transaction done');
      });
    });
  }
}

module.exports = MoneySender;
