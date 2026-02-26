const { db } = require('../db');

module.exports = function subscriberJoin(from, petName, twiml) {
  const pet = db.prepare('SELECT * FROM pets WHERE name = ?').get(petName.toUpperCase());
  if (!pet) {
    return twiml(`No pet named ${petName} found here. Check the name and try again.`);
  }

  const existing = db.prepare('SELECT * FROM subscribers WHERE pet_id = ? AND phone = ?').get(pet.id, from);

  if (existing && existing.active) {
    return twiml(`You're already getting ${pet.emoji} ${pet.name}'s thoughts. Reply STOP anytime to unsubscribe.`);
  }

  if (existing && !existing.active) {
    db.prepare('UPDATE subscribers SET active = 1 WHERE id = ?').run(existing.id);
    return twiml(`Welcome back! You're re-subscribed to ${pet.emoji} ${pet.name}'s thoughts. One per day.`);
  }

  db.prepare('INSERT INTO subscribers (pet_id, phone) VALUES (?, ?)').run(pet.id, from);
  twiml(`You're now subscribed to ${pet.emoji} ${pet.name}'s inner life. Expect one thought per day. Reply STOP anytime.`);
};
