const { db } = require('../db');

const MAX_THOUGHT_LENGTH = 500;

module.exports = function ownerAddThought(pet, body, twiml) {
  if (!body || body.length < 3) {
    return twiml("That thought seems a bit short. Try again with something more substantial.");
  }
  if (body.length > MAX_THOUGHT_LENGTH) {
    return twiml(`That thought is too long. Keep it under ${MAX_THOUGHT_LENGTH} characters.`);
  }

  db.prepare('INSERT INTO thoughts (pet_id, body) VALUES (?, ?)').run(pet.id, body);
  const count = db.prepare('SELECT COUNT(*) as n FROM thoughts WHERE pet_id = ?').get(pet.id).n;
  twiml(`Got it. ${pet.name} now has ${count} thought${count === 1 ? '' : 's'}.`);
};
