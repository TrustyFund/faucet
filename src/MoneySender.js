const { TransactionHelper } = require('bitsharesjs');
const { Aes } = require('bitsharesjs');
const { TransactionBuilder } = require('bitsharesjs');
const { Apis } = require('bitsharesjs-ws');

class MoneySender {
  constructor(sendAmount, privateKey, memoKey, fromAccountId) {
    this.sendAmount = sendAmount;
    this.pKey = privateKey;
    this.memoFromKey = memoKey;
    this.fromAccountId = fromAccountId;
  }

  async sendMoneyToUser(toAccountName) {
    if (!this.sendAmount.amount) return;

    const toAccount = await Apis.instance().db_api().exec('get_account_by_name', [toAccountName]);
    const memo = '';
    console.log('toAccount', JSON.stringify(toAccount));
    const memoToKey = toAccount.options.memo_key;
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
        asset_id: this.sendAmount.assetId
      },
      from: this.fromAccountId,
      to: toAccount.id,
      amount: { amount: this.sendAmount.amount, asset_id: this.sendAmount.assetId },
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
