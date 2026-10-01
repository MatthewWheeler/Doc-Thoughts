require('dotenv').config();
const express = require('express');
const path = require('path');
const { initSchema } = require('./db');
const { seedDoc } = require('./seed');
const { startScheduler } = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: false }));  // Twilio sends URL-encoded bodies
app.use(express.json());

app.use('/sms', require('./routes/sms'));
app.use('/api/thoughts', require('./routes/thoughts'));

// Serve only the public page — never the project root (it contains data/ and source)
app.use(express.static(path.join(__dirname, '../public')));

if (process.env.SKIP_TWILIO_SIGNATURE === 'true') {
  console.warn('WARNING: SKIP_TWILIO_SIGNATURE=true — /sms accepts unsigned requests. Never set this in production.');
}

// Startup sequence
initSchema();
seedDoc();
startScheduler();

app.listen(PORT, () => {
  console.log(`Doc-Thoughts running on http://localhost:${PORT}`);
});
