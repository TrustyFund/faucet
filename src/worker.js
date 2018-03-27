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

function isSymbolIsLetter(symbol) {
  if (!(symbol >= 'a' && symbol <= 'z')) return false;
  return true;
}

function isSymbolIsDigit(symbol) {
  if (!(symbol >= '0' && symbol <= '9')) return false;
  return true;
}

function isValidSequence(sequence) {
  for (let i = 0; i < sequence.length; i += 1) {
    if (!(isSymbolIsLetter(sequence.charAt(i)) ||
        isSymbolIsDigit(sequence.charAt(i)) ||
        sequence.charAt(i) === '-')) {
      return false;
    }
  }
  return true;
}

function isNameValid(name) {
  const labels = name.split('.');
  for (let i = 0; i < labels.length; i += 1) {
    if (!isSymbolIsLetter(labels[i].charAt(0))) {
      return false;
    }

    if (!(isSymbolIsLetter(labels[i].charAt(labels[i].length - 1)) ||
      isSymbolIsDigit(labels[i].length - 1))) {
      return false;
    }

    if (!isValidSequence(labels[i])) return false;
  }
  return true;
}

function isCheapName(name) {
  for (let i = 0; i < name.length; i += 1) {
    const c = name.charAt(i);
    if (c >= '0' && c <= '9') return true;
    if (c === '.' || c === '-' || c === '/') return true;
    switch (c) {
      case 'a':
      case 'e':
      case 'i':
      case 'o':
      case 'u':
      case 'y':
        return true;
      default:
        break;
    }
  }
  return false;
}

async function startHost(port, pKey) {
  const ipTime = [];
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

    if (ipTime.some(x => x.ip === req.remoteAddress)) {
      res.status(400);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(JSON.stringify({
        result: 'You cannot register a user more than once every five minutes'
      }));
      return;
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
