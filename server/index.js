require('dotenv').config();
const express = require('express');
const path = require('path');
const { initSchema } = require('./db');
const { seedIfEmpty } = require('./seed');
const { startScheduler } = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: false }));  // Twilio sends URL-encoded bodies
app.use(express.json());

app.use('/sms', require('./routes/sms'));
app.use('/api/thoughts', require('./routes/thoughts'));

// Serve static files (index.html, thoughts.json, etc.) from project root
app.use(express.static(path.join(__dirname, '..')));

// Startup sequence
initSchema();
seedIfEmpty();
startScheduler();

app.listen(PORT, () => {
  console.log(`Doc-Thoughts running on http://localhost:${PORT}`);
});
