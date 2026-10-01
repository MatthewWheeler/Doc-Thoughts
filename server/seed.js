const path = require('path');
const { db } = require('./db');

// Registers Doc (if needed) and adds any thoughts.json entries Doc doesn't have yet.
// Additive: never removes or alters existing thoughts, including ones the owner texted in.
function seedDoc() {
  let pet = db.prepare('SELECT * FROM pets WHERE name = ?').get('DOC');

  if (!pet) {
    const ownerPhone = process.env.DOC_OWNER_PHONE;
    if (!ownerPhone) {
      console.log('Seed: DOC_OWNER_PHONE not set, skipping Doc seed.');
      return;
    }
    db.prepare('INSERT INTO pets (name, owner_phone, emoji) VALUES (?, ?, ?)').run('DOC', ownerPhone, '🐾');
    pet = db.prepare('SELECT * FROM pets WHERE name = ?').get('DOC');
    console.log('Seed: Registered Doc.');
  }

  const thoughts = require(path.join(__dirname, '../thoughts.json'));
  const insert = db.prepare(
    'INSERT INTO thoughts (pet_id, body) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM thoughts WHERE pet_id = ? AND body = ?)'
  );
  const insertMissing = db.transaction((items) => {
    let added = 0;
    for (const body of items) added += insert.run(pet.id, body, pet.id, body).changes;
    return added;
  });
  const added = insertMissing(thoughts);
  console.log(`Seed: Added ${added} new thought${added === 1 ? '' : 's'} for Doc.`);
}

module.exports = { seedDoc };
