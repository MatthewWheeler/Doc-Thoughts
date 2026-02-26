const express = require('express');
const router = express.Router();
const { db } = require('../db');

router.get('/:petName', (req, res) => {
  const petName = req.params.petName.toUpperCase();
  const pet = db.prepare('SELECT * FROM pets WHERE name = ?').get(petName);
  if (!pet) return res.status(404).json({ error: 'Pet not found' });

  const thoughts = db.prepare('SELECT body FROM thoughts WHERE pet_id = ? ORDER BY created_at ASC').all(pet.id);
  res.json(thoughts.map(t => t.body));
});

module.exports = router;
