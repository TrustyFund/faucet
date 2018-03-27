const config = require('../config');
const express = require('express');
const bodyParser = require('body-parser');
const { userRegistration } = require('./AccountCreator');
const { key } = require('bitsharesjs');
const MoneySender = require('./MoneySender');
const { isNameValid, isCheapName } = require('./NameValidator');

function getPrivateKey(brainkey) {
  const normalizedBrainkey = key.normalize_brainKey(brainkey);
  const pKey = key.get_brainPrivateKey(normalizedBrainkey, 1);
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

  const moneySender = new MoneySender(config.defaultAmountToSend, pKey, config.serviceUserMemoKey, config.registarUserId); 

  const host = express();
  host.use(bodyParser.urlencoded({ extended: true }));

  host.post('/signup', async (req, res) => {
    console.log(req.connection.remoteAddress);

    const { name, active_key, owner_key } = req.body;

    if (!name || !active_key || !owner_key) {
      res.setHeader('Access-Control-Allow-Origin', '*');
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
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(JSON.stringify({
        result: 'Name is not valid'
      }));
      return;
    }

    if (!isCheapName(name)) {
      res.status(400);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(JSON.stringify({
        result: 'Only cheap names is allowed'
      }));
      return;
    }

    if (ipTime[req.connection.remoteAddress]) {
      if (ipTime[req.connection.remoteAddress] >
          Date.now() - (config.registrationDelayInMinutes * 60 * 1000)) {
        res.status(400);
        res.setHeader('Access-Control-Allow-Origin', '*');
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
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (result) {
        moneySender.sendMoneyToUser(name);
        ipTime[req.connection.remoteAddress] = Date.now();
        res.send(JSON.stringify({
          result: 'OK',
          name
        }));
      } else {
        res.status(400);
        res.send(JSON.stringify({
          result: 'ERROR'
        }));
      }
    } catch (error) {
      res.status(400);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(JSON.stringify({
        result: 'ERROR'
      }));
    }
  });

  host.listen(port, () => {
    console.log('host is up');
  });
}


async function processWork() {
  console.log('worker is up');
  const pKey = getPrivateKey(config.serviceUserBrainkey);
  startHost(config.defaultPort, pKey);
}

module.exports = processWork;
