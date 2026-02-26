#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { db, initSchema } = require('../db');

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const name = get('--name');
const ownerPhone = get('--owner');
const emoji = get('--emoji') || '🐾';
const breed = get('--breed') || null;

if (!name || !ownerPhone) {
  console.error('Usage: node register-pet.js --name "Buddy" --owner "+15551112222" [--emoji "🐶"] [--breed "Labrador"]');
  process.exit(1);
}

if (!/^\+[1-9]\d{7,14}$/.test(ownerPhone)) {
  console.error('Error: owner phone must be in E.164 format, e.g. +15551112222');
  process.exit(1);
}

initSchema();

const existing = db.prepare('SELECT * FROM pets WHERE name = ?').get(name.toUpperCase());
if (existing) {
  console.error(`Error: A pet named ${name.toUpperCase()} already exists.`);
  process.exit(1);
}

const result = db.prepare(
  'INSERT INTO pets (name, owner_phone, emoji) VALUES (?, ?, ?)'
).run(name.toUpperCase(), ownerPhone, emoji);

console.log(`Registered ${emoji} ${name.toUpperCase()} (id: ${result.lastInsertRowid})`);
console.log(`Owner: ${ownerPhone}`);
console.log(`Family members can subscribe by texting: JOIN ${name.toUpperCase()}`);
