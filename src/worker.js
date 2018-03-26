const config = require('../config');
const express = require('express');
const bodyParser = require('body-parser');
const { userRegistration } = require('./AccountCreator');
const { key } = require('bitsharesjs');
const MoneySender = require('./MoneySender');

function getPrivateKey(brainkey) {
  const normalizedBrainkey = key.normalize_brainKey(brainkey);
  const pKey = key.get_brainPrivateKey(normalizedBrainkey, 1);
  return pKey;
}

async function startHost(port, pKey) {
  const moneySender = new MoneySender(config.defaultAmountToSend, pKey, config.serviceUserMemoKey, config.registarUserId); 

  const host = express();
  host.use(bodyParser.urlencoded({ extended: true }));

  host.post('/signup', async (req, res) => {
    const { name, active_key, owner_key } = req.body;
    const regData = {
      name,
      activeKey: active_key,
      ownerKey: owner_key,
      registarUserId: config.registarUserId,
      referrerUserId: config.referrerUserId,
      referrerPercent: config.referrerPercent,
      pKey
    };
    const result = await userRegistration(regData);
    console.log(result);
    if (result) {
      moneySender.sendMoneyToUser(name);
      res.send(JSON.stringify({
        result: 'OK',
        name
      }));
    } else {
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
