const config = require('../config');
const express = require('express');
const bodyParser = require('body-parser');
const { userRegistration } = require('./AccountCreator');
const { key, PrivateKey, TransactionBuilder } = require('bitsharesjs');
const NotificationSubscriber = require('./NotificationSubscriber');
const { isNameValid, isCheapName } = require('./NameValidator');
const { Apis, ChainConfig } = require('bitsharesjs-ws');
const dictionary = require('./dictionary');

const OWNER_KEY_INDEX = 1;
const ACTIVE_KEY_INDEX = 0;

const ipTime = {};
let pKey;


async function signTransaction(transaction) {
  transaction.add_signer(pKey, pKey.toPublicKey().toPublicKeyString());
  return transaction;
}

async function signAndBroadcastTransaction(transaction) {
  return new Promise(async (resolve) => {
    const broadcastTimeout = setTimeout(() => {
      resolve({ success: false, error: 'expired' });
    }, ChainConfig.expire_in_secs * 2000);

    signTransaction(transaction, pKey);

    try {
      await transaction.set_required_fees();
      await transaction.broadcast();
      console.log('finish await broadcast');
      clearTimeout(broadcastTimeout);
      resolve({ success: true });
    } catch (error) {
      clearTimeout(broadcastTimeout);
      resolve({ success: false, error });
    }
  });
}


async function transfer(toId) {
  // const toAccount = await serviceBS.getUserByUserId(toId);
  const transferObject = {
    fee: {
      amount: 0,
      asset_id: '1.3.0'
    },
    from: config.registarUserId,
    to: toId,
    amount: {
      amount: config.defaultAmountToSend.amount,
      asset_id: config.defaultAmountToSend.assetId
    }
  };
  console.log('transferObject: ', transferObject);

  const transaction = new TransactionBuilder();
  transaction.add_type_operation('transfer', transferObject);
  return signAndBroadcastTransaction(transaction, pKey);
}


function clearAddressesTimeout() {
  const now = Date.now();
  const keys = Object.keys(ipTime);
  keys.forEach(addr => {
    if (ipTime[addr] < (now - (config.registrationDelayInMinutes * 60 * 1000))) {
      delete ipTime[addr];
    }
  });
}

async function startHost(port) {
  setInterval(clearAddressesTimeout, config.clearRegisrationInMinutes * 60 * 1000);

  let subscriber;
  if (config.notiferUserId) {
    subscriber = new NotificationSubscriber(
      pKey,
      config.serviceUserMemoKey,
      config.registarUserId,
      config.notiferUserId
    );
  }

  const host = express();
  host.use(bodyParser.urlencoded({ extended: true }));

  host.post('/signup', async (req, res) => {
    const { name, active_key, owner_key, email } = req.body;
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (!name || !active_key || !owner_key) {
      res.status(400);
      res.send(JSON.stringify({
        result: 'Both name, active_key, owner_key must be in request'
      }));
      return;
    }

    if (name.length < config.minNameLength || name.length > config.maxNameLength) {
      res.status(400);
      res.send(JSON.stringify({
        result: 'Length of the name beyond the allowed'
      }));
      return;
    }

    if (!isNameValid(name)) {
      res.status(400);
      res.send(JSON.stringify({
        result: 'Name is not valid'
      }));
      return;
    }

    if (!isCheapName(name)) {
      res.status(400);
      res.send(JSON.stringify({
        result: 'Only cheap names is allowed'
      }));
      return;
    }


    try {
      const userCheckResponse = await Apis.instance().db_api().exec('get_accounts', [[name], false]);
      console.log('userCheck:', userCheckResponse);
      if (userCheckResponse.length) {
        const [userCheck] = userCheckResponse;
        if (userCheck.id) {
          res.status(400);
          res.send(JSON.stringify({
            result: 'This name is already registered'
          }));
          return;
        }
      }
    } catch (error) {
      console.log('find error: ', error);
      console.log('but it\'s fine');
    }

    if (ipTime[req.connection.remoteAddress]) {
      if (ipTime[req.connection.remoteAddress] >
          Date.now() - (config.registrationDelayInMinutes * 60 * 1000)) {
        res.status(400);
        res.send(JSON.stringify({
          result: 'You cannot register a user more than once every ' +
            `${config.registrationDelayInMinutes} minutes`
        }));
        return;
      }
    }
    const regData = {
      name,
      activeKey: active_key,
      ownerKey: owner_key,
      registarUserId: config.registarUserId,
      referrerUserId: config.referrerUserId,
      referrerPercent: config.referrerPercent,
      pKey
    };
    try {
      const result = await userRegistration(regData);
      if (result) {
        const id = result[0].trx.operation_results[0][1];

        if (email && subscriber) {
          subscriber.subscribe(id, email);
        }

        ipTime[req.connection.remoteAddress] = Date.now();

        res.send(JSON.stringify({
          result: 'OK',
          name,
          id
        }));
        await transfer(id);
      } else {
        res.status(400);
        res.send(JSON.stringify({
          result: 'Please try again'
        }));
      }
    } catch (error) {
      res.status(400);
      res.send(JSON.stringify({
        result: 'Please try again'
      }));
    }
  });

  host.listen(port, () => {
    console.log('host is up');
  });
}


async function processWork() {
  console.log('worker is up');
  const brainKey = key.suggest_brain_key(dictionary.en);
  console.log(brainKey);
  const normalizedBrainKey = key.normalize_brainKey(brainKey);
  const activeKey = key.get_brainPrivateKey(normalizedBrainKey, ACTIVE_KEY_INDEX);
  const ownerKey = key.get_brainPrivateKey(normalizedBrainKey, OWNER_KEY_INDEX);
  const ownerPubKey = ownerKey.toPublicKey().toPublicKeyString();
  const activePubKey = activeKey.toPublicKey().toPublicKeyString();

  console.log(activePubKey);
  console.log(ownerPubKey);

  pKey = PrivateKey.fromWif(config.serviceUserPrivateKey);

  startHost(config.defaultPort);
}

module.exports = processWork;
