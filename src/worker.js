const config = require('../config');
const express = require('express');
const bodyParser = require('body-parser');
const { userRegistration } = require('./AccountCreator');
const { key, PrivateKey } = require('bitsharesjs');
const NotificationSubscriber = require('./NotificationSubscriber');
const { isNameValid, isCheapName } = require('./NameValidator');
const { Apis } = require('bitsharesjs-ws');


function getPrivateKey(brainkey) {
  const normalizedBrainkey = key.normalize_brainKey(brainkey);
  const pKey = key.get_brainPrivateKey(normalizedBrainkey);
  return pKey;
}

const ipTime = {};

function clearAddressesTimeout() {
  const now = Date.now();
  const keys = Object.keys(ipTime);
  keys.forEach(addr => {
    if (ipTime[addr] < (now - (config.registrationDelayInMinutes * 60 * 1000))) {
      delete ipTime[addr];
    }
  });
}

async function startHost(port, pKey) {
  setInterval(clearAddressesTimeout, config.clearRegisrationInMinutes * 60 * 1000);

  let subscriber;
  if (config.notiferUserId) {
    subscriber = new NotificationSubscriber(pKey, config.serviceUserMemoKey, config.registarUserId, config.notiferUserId);
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

  const pKey = PrivateKey.fromWif(config.serviceUserPrivateKey);
  startHost(config.defaultPort, pKey);
}

module.exports = processWork;
