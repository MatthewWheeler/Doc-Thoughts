const path = require('path');
const { db } = require('./db');

function seedIfEmpty() {
  const ownerPhone = process.env.DOC_OWNER_PHONE;
  if (!ownerPhone) {
    console.log('Seed: DOC_OWNER_PHONE not set, skipping Doc seed.');
    return;
  }

  let pet = db.prepare('SELECT * FROM pets WHERE name = ?').get('DOC');
  if (!pet) {
    db.prepare('INSERT INTO pets (name, owner_phone, emoji) VALUES (?, ?, ?)').run('DOC', ownerPhone, '🐾');
    pet = db.prepare('SELECT * FROM pets WHERE name = ?').get('DOC');
    console.log('Seed: Registered Doc.');
  }

  const count = db.prepare('SELECT COUNT(*) as n FROM thoughts WHERE pet_id = ?').get(pet.id).n;
  if (count > 0) {
    console.log(`Seed: Doc already has ${count} thoughts, skipping.`);
    return;
  }

  const thoughts = require(path.join(__dirname, '../thoughts.json'));
  const insert = db.prepare('INSERT INTO thoughts (pet_id, body) VALUES (?, ?)');
  const insertMany = db.transaction((items) => {
    for (const body of items) insert.run(pet.id, body);
  });
  insertMany(thoughts);
  console.log(`Seed: Inserted ${thoughts.length} thoughts for Doc.`);
}

module.exports = { seedIfEmpty };
