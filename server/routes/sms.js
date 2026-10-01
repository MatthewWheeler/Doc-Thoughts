const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const { db } = require('../db');
const ownerAddThought = require('../handlers/ownerAddThought');
const subscriberJoin = require('../handlers/subscriberJoin');
const unknownSender = require('../handlers/unknownSender');

function twimlReply(res, message) {
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(message);  // escapes XML
  res.type('text/xml');
  res.send(twiml.toString());
}

function validateSignature(req, res, next) {
  // Explicit dev-only opt-out for curl testing
  if (process.env.SKIP_TWILIO_SIGNATURE === 'true') return next();

  const webhookUrl = process.env.WEBHOOK_URL;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  // Fail closed: without these we can't verify the request came from Twilio
  if (!webhookUrl || !authToken) {
    console.error('SMS: Rejecting request — WEBHOOK_URL and TWILIO_AUTH_TOKEN must be set (or SKIP_TWILIO_SIGNATURE=true in dev).');
    return res.status(403).send('Forbidden');
  }

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
