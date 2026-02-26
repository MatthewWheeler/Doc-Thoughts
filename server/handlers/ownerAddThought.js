const { db } = require('../db');

module.exports = function ownerAddThought(pet, body, twiml) {
  if (!body || body.length < 3) {
    return twiml("That thought seems a bit short. Try again with something more substantial.");
  }

  db.prepare('INSERT INTO thoughts (pet_id, body) VALUES (?, ?)').run(pet.id, body);
  const count = db.prepare('SELECT COUNT(*) as n FROM thoughts WHERE pet_id = ?').get(pet.id).n;
  twiml(`Got it. ${pet.name} now has ${count} thought${count === 1 ? '' : 's'}.`);
};
