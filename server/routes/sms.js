const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const { db } = require('../db');
const ownerAddThought = require('../handlers/ownerAddThought');
const subscriberJoin = require('../handlers/subscriberJoin');
const unknownSender = require('../handlers/unknownSender');

function twimlReply(res, message) {
  res.type('text/xml');
  res.send(`<?xml version="1.0"?><Response><Message>${message}</Message></Response>`);
}

function validateSignature(req, res, next) {
  const webhookUrl = process.env.WEBHOOK_URL;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  // Skip validation in dev (no WEBHOOK_URL set)
  if (!webhookUrl || !authToken) return next();

  const signature = req.headers['x-twilio-signature'];
  if (twilio.validateRequest(authToken, signature, webhookUrl, req.body)) {
    return next();
  }
  res.status(403).send('Forbidden');
}

router.post('/', validateSignature, (req, res) => {
  const from = (req.body.From || '').trim();
  const body = (req.body.Body || '').trim();

  const reply = (msg) => twimlReply(res, msg);

  const owner = db.prepare('SELECT * FROM pets WHERE owner_phone = ?').get(from);
  if (owner) return ownerAddThought(owner, body, reply);

  const joinMatch = body.match(/^JOIN\s+(\w+)/i);
  if (joinMatch) return subscriberJoin(from, joinMatch[1], reply);

  return unknownSender(reply);
});

module.exports = router;
