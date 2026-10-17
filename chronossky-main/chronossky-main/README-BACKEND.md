# ChronoSky + Star Traveler backend (v21.1)

This version adds the requested Express + MongoDB Star Traveler backend while keeping ChronoSky's existing era, planet, atmosphere, quiz, saved-world, prompt-builder and feedback endpoints.

## Requirements
- Node.js 18+
- MongoDB running locally or a MongoDB Atlas connection string

## Setup
1. Copy `.env.example` to `.env`.
2. Set `MONGO_URI` to your MongoDB connection string.
3. Set `JWT_SECRET` to a unique random secret (at least 32 characters). Never publish `.env` or commit it.
4. Run `npm install` and `npm start`.
5. Open `http://localhost:5000`.

## Star API
- `GET /api/stars` — curated stars, database IDs, facts and coordinates.
- `POST /api/auth/register` — `{ "username", "email", "password" }`; returns JWT and public user profile.
- `POST /api/auth/login` — `{ "email", "password" }`; returns JWT and public user profile.
- `POST /api/stars/:starId/visit` — authenticated; pass `x-auth-token: <JWT>` (Bearer authorization also works).
- `GET /api/stars/visited` — authenticated; returns visited star records.
- `GET /api/health` — API/database status.

### Seed the initial curated star catalogue
Seeding is intentionally disabled by default. For local setup only, temporarily set `ENABLE_SEED=true` in `.env`, restart the server, then send `POST http://localhost:5000/seed` (for example with curl or Postman). Once seeded, set `ENABLE_SEED=false` and restart. This seeds 16 curated records; it does not fabricate 1,000 fake astronomical discoveries.

## Existing ChronoSky endpoints retained
- `GET/POST /api/state`
- `GET /api/eras`, `GET /api/planets`
- `POST /api/atmosphere/calculate`
- `POST /api/quiz-results`, `GET /api/quiz-results/latest`
- `POST /api/worlds`, `GET /api/worlds/:id`
- `POST /api/world-builder`, `POST /api/feedback`

## Important persistence note
The new user accounts, stars and star visit logs use MongoDB. The pre-existing general ChronoSky state/quiz/world/feedback endpoints are retained in-process for compatibility and reset when the server restarts. If those records also need durable MongoDB storage, they should be migrated to dedicated Mongoose models before production use.

## Frontend integration pattern
After login/register, store the returned token in sessionStorage (prefer session over local storage for a demo), then:
```js
const token = sessionStorage.getItem('startravelerToken');
const stars = await fetch('/api/stars').then(r => r.json());
await fetch(`/api/stars/${starMongoId}/visit`, {
  method: 'POST', headers: { 'x-auth-token': token }
});
const visited = await fetch('/api/stars/visited', {
  headers: { 'x-auth-token': token }
}).then(r => r.json());
```
The visit route requires MongoDB's `_id` for a star, not a visual `data-star` slug. Map the returned records by `slug` when connecting the existing in-scene buttons.
