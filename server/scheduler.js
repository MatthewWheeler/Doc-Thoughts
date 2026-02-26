const cron = require('node-cron');
const twilio = require('twilio');
const { db } = require('./db');

const SEND_WINDOW_START = parseInt(process.env.SEND_WINDOW_START || '480', 10);  // 8am
const SEND_WINDOW_RANGE = parseInt(process.env.SEND_WINDOW_RANGE || '720', 10);  // 12h window

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function sendThoughtForPet(petId) {
  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(petId);
  if (!pet) return;

  const subscribers = db.prepare('SELECT phone FROM subscribers WHERE pet_id = ? AND active = 1').all(petId);
  if (!subscribers.length) {
    console.log(`Scheduler: No active subscribers for ${pet.name}, skipping.`);
    return;
  }

  const thought = db.prepare(
    'SELECT id, body FROM thoughts WHERE pet_id = ? ORDER BY sent_count ASC, RANDOM() LIMIT 1'
  ).get(petId);

  if (!thought) {
    console.log(`Scheduler: No thoughts for ${pet.name}, skipping.`);
    return;
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const message = `From ${pet.emoji} ${pet.name}: ${thought.body}`;

  const sends = subscribers.map(sub =>
    client.messages.create({
      body: message,
      from: process.env.TWILIO_FROM,
      to: sub.phone,
    }).catch(err => console.error(`Scheduler: Failed to send to ${sub.phone}:`, err.message))
  );

  Promise.allSettled(sends).then(results => {
    const sent = results.filter(r => r.status === 'fulfilled').length;
    console.log(`Scheduler: Sent ${pet.name}'s thought to ${sent}/${subscribers.length} subscribers.`);
  });

  db.prepare('UPDATE thoughts SET sent_count = sent_count + 1 WHERE id = ?').run(thought.id);
  db.prepare('UPDATE pets SET last_sent_date = ? WHERE id = ?').run(getTodayStr(), petId);
}

function scheduleForPet(pet, delayMs) {
  const minutesFromNow = Math.round(delayMs / 60000);
  console.log(`Scheduler: ${pet.name} will receive a thought in ~${minutesFromNow} minutes.`);
  setTimeout(() => sendThoughtForPet(pet.id), delayMs);
}

function scheduleDailyForAllPets() {
  const pets = db.prepare('SELECT * FROM pets').all();
  const now = new Date();
  const midnightMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  for (const pet of pets) {
    const offsetMs = (SEND_WINDOW_START + Math.floor(Math.random() * SEND_WINDOW_RANGE)) * 60 * 1000;
    const sendAt = midnightMs + offsetMs;
    const delayMs = sendAt - Date.now();

    if (delayMs > 0) {
      scheduleForPet(pet, delayMs);
    }
  }
}

function rescheduleIfMissed() {
  const today = getTodayStr();
  const pets = db.prepare('SELECT * FROM pets WHERE last_sent_date IS NULL OR last_sent_date < ?').all(today);

  for (const pet of pets) {
    const now = Date.now();
    const endOfWindow = new Date().setHours(20, 0, 0, 0);  // 8pm cutoff

    if (now < endOfWindow) {
      // Still within window — send at a random time in the remaining window
      const remaining = endOfWindow - now;
      const delay = Math.floor(Math.random() * remaining);
      scheduleForPet(pet, delay);
    } else {
      // Missed today's window — it'll catch tomorrow's midnight cron
      console.log(`Scheduler: ${pet.name} missed today's window, will send tomorrow.`);
    }
  }
}

function startScheduler() {
  // Reschedule any pets that haven't sent today on startup
  rescheduleIfMissed();

  // At midnight each day, schedule today's sends for all pets
  cron.schedule('0 0 * * *', () => {
    console.log('Scheduler: Midnight — scheduling daily thoughts.');
    scheduleDailyForAllPets();
  });

  console.log('Scheduler: Started.');
}

module.exports = { startScheduler, sendThoughtForPet };
