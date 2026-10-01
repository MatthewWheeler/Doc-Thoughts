# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Doc-Thoughts is an SMS service that texts subscribers one "thought" per day from a pet (originally just Doc, a dog). It has two parts: a Node/Express server backed by SQLite with Twilio for SMS, and a single static page (`public/index.html`) that shows Doc's thoughts in the browser.

## Commands

```bash
npm install
cp .env.example .env          # then fill in Twilio creds and DOC_OWNER_PHONE
npm start                     # node server/index.js → http://localhost:3000

# Exercise the SMS webhook locally (requires SKIP_TWILIO_SIGNATURE=true in .env)
curl -X POST localhost:3000/sms --data-urlencode From=+15550001111 --data-urlencode 'Body=JOIN doc'

# Register an additional pet (name is stored uppercased; owner must be E.164)
node server/scripts/register-pet.js --name "Buddy" --owner "+15551112222" [--emoji "🐶"]
```

The project has no test suite, linter, or build step (`npm test` is the npm placeholder and exits 1). Deployment is Railway via Nixpacks (`railway.toml`), with a persistent volume at `/app/data`, so set `DB_PATH=/app/data/thoughts.db` there. Production also needs `WEBHOOK_URL` set to the exact public `/sms` URL, or every inbound text gets a 403.

## Architecture

**Startup** (`server/index.js`): `initSchema()` creates tables if they're missing → `seedDoc()` → `startScheduler()` → listen. Only `public/` is served as static files. Never serve the project root: it would expose `data/thoughts.db`, which holds phone numbers.

**Data model** (`server/db.js`): three tables, `pets`, `thoughts` and `subscribers`, in one shared `better-sqlite3` handle (synchronous API, WAL mode, foreign keys on). The schema is created in place with `CREATE TABLE IF NOT EXISTS`, and there is no migration system. A schema change means editing `initSchema()` and handling existing databases by hand. Pet names are always stored **uppercase**, and every lookup uppercases its input first.

**Seeding** (`server/seed.js`): `seedDoc()` registers the pet `DOC` if it's missing, which requires `DOC_OWNER_PHONE`. On every startup it then adds any `thoughts.json` entries Doc doesn't already have, matching on exact body text. It never deletes or edits anything, so thoughts texted in by the owner are kept. To add more Doc thoughts, append to `thoughts.json`. Editing a seeded thought's wording inserts it again as a new thought. New thoughts start with `sent_count = 0`, so the scheduler sends them before repeating any.

**Inbound SMS** (`POST /sms`, `server/routes/sms.js`): this is a Twilio webhook. It dispatches on the sender, in this order:
1. The sender's phone matches a `pets.owner_phone` → `handlers/ownerAddThought` (the whole message body becomes a new thought for that owner's pet; 3–500 characters).
2. The body matches `JOIN <name>` → `handlers/subscriberJoin` (subscribes the sender, or reactivates an inactive subscription).
3. Anything else → `handlers/unknownSender` (help text).

Each handler gets a `reply(msg)` callback that builds TwiML with `twilio.twiml.MessagingResponse`, which escapes the text. Twilio signature validation **rejects by default**: if `WEBHOOK_URL` or `TWILIO_AUTH_TOKEN` is missing, every request gets a 403. The only bypass is `SKIP_TWILIO_SIGNATURE=true`, which is for dev only and logs a warning at startup. STOP/unsubscribe is handled by Twilio's built-in opt-out, and no app code sets `subscribers.active = 0`.

**Outbound scheduling** (`server/scheduler.js`): this is in-process. Pending sends live in `setTimeout`s, so they are lost when the server restarts.
- At midnight, a `node-cron` job gives each pet a random send time within `SEND_WINDOW_START` + `SEND_WINDOW_RANGE` (in minutes after midnight).
- On startup, `rescheduleIfMissed()` finds pets whose `last_sent_date` is before today and schedules them at a random time before a **hardcoded 8pm** cutoff. That cutoff ignores the window env vars.
- `sendThoughtForPet` picks the least-sent thought, choosing randomly among ties (`ORDER BY sent_count, RANDOM()`). It sends the thought to all active subscribers, then increments `sent_count` and sets `last_sent_date`. It does this without waiting for the Twilio sends to finish, so the thought counts as sent even if every send fails.
- `last_sent_date` is a UTC date (`toISOString`), but the window is computed from local midnight.

**Frontend** (`index.html`): this is a self-contained page. It fetches `GET /api/thoughts/doc` (`server/routes/thoughts.js` returns a JSON array of strings) and falls back to a hardcoded list when you open it without the server.
